"""Buyer inquiries to shops: a working mock of in-app messaging between buyers and the seller panel.

No SMS, call or push is sent: the seller sees new questions in the panel and the buyer sees answers in the app.
Buyers have no account; they hold a random token in their own browser, stored here only as a hash.
A seller's answer goes only to the buyer who asked and never becomes a public price."""
import hashlib
import logging
import re
import secrets
from datetime import timedelta

from django.db import DatabaseError, transaction
from django.db.models import F, Prefetch
from django.utils import timezone

from .domain import constraints, normalize, parse_price
from .models import Inquiry, InquiryMessage, SearchMiss, Shop

QUESTIONS = {'stock': 'موجود است؟', 'price': 'قیمت امروز چند است؟', 'installment': 'اقساط حضوری دارید؟', 'warranty': 'گارانتی دارد؟'}
KEEP = timedelta(days=14)
logger = logging.getLogger(__name__)
TOKEN = re.compile(r'[A-Za-z0-9_-]{20,64}')
SHOP_ID = re.compile(r'shop_[a-zA-Z0-9]+')


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _message(m):
    return dict(sender=m.sender, text=m.text, available=m.available, price=m.price, created_at=m.created_at.isoformat())


def serialize(row, messages=False):
    data = dict(id=row.id, shop=dict(id=row.shop_id, name=row.shop.name, area=row.shop.area),
                product=dict(id=row.product_id, name=row.product.title) if row.product_id else None,
                questions=[QUESTIONS[q] for q in row.questions if q in QUESTIONS], note=row.note,
                created_at=row.created_at.isoformat(), answered_at=row.answered_at.isoformat() if row.answered_at else None,
                updated_at=(row.updated_at or row.created_at).isoformat(),
                available=row.available, price=row.price, reply=row.reply, seller_unread=row.seller_unread)
    if messages:
        data['messages'] = [_message(m) for m in row.messages.all()]
    return data


def _text(value, limit):
    return re.sub(r'\s+', ' ', str(value or '')).strip()[:limit]


def create(payload):
    from .services import require_product
    if not isinstance(payload, dict):
        raise ValueError('Invalid inquiry')
    shop_ids = payload.get('shop_ids')
    if not isinstance(shop_ids, list) or not all(isinstance(s, str) and SHOP_ID.fullmatch(s) for s in shop_ids):
        raise ValueError('Invalid shops')
    shop_ids = list(dict.fromkeys(shop_ids))
    if not 1 <= len(shop_ids) <= 5:
        raise ValueError('Ask one to five shops')
    questions = [q for q in dict.fromkeys(payload.get('questions') or []) if isinstance(q, str) and q in QUESTIONS]
    note = _text(payload.get('note'), 200)
    if not questions and not note:
        raise ValueError('Ask at least one question')
    product = require_product(str(payload['product_id'])) if payload.get('product_id') else None
    shops = list(Shop.objects.filter(pk__in=shop_ids))
    if len(shops) != len(shop_ids):
        raise LookupError('Shop not found')
    now, token = timezone.now(), secrets.token_urlsafe(24)
    Inquiry.objects.filter(created_at__lt=now - KEEP).delete()
    rows = Inquiry.objects.bulk_create([Inquiry(id=secrets.token_hex(8), token_hash=_hash(token), shop=s, product=product,
                                                questions=questions, note=note, created_at=now, updated_at=now) for s in shops])
    return dict(token=token, ids=[r.id for r in rows])


def _buyer_rows(tokens):
    tokens = [t for t in tokens if isinstance(t, str) and TOKEN.fullmatch(t)][:20]
    if not tokens:
        raise ValueError('No inquiry tokens')
    return Inquiry.objects.filter(token_hash__in=[_hash(t) for t in tokens], created_at__gte=timezone.now() - KEEP)


def for_buyer(args):
    rows = _buyer_rows((args.get('tokens') or '').split(',')).select_related('shop', 'product').prefetch_related('messages')
    return dict(items=[serialize(r, messages=True) for r in rows.order_by('-created_at')[:50]])


@transaction.atomic
def buyer_reply(payload):
    """A buyer's follow-up in an existing thread; only the token that created the inquiry can write to it."""
    if not isinstance(payload, dict):
        raise ValueError('Invalid message')
    row = _buyer_rows([payload.get('token')]).select_for_update().filter(pk=str(payload.get('id') or '')).first()
    if not row:
        raise LookupError('Inquiry not found')
    text = _text(payload.get('text'), 500)
    if not text:
        raise ValueError('Write a message')
    now = timezone.now()
    InquiryMessage.objects.create(inquiry=row, sender='buyer', text=text, created_at=now)
    Inquiry.objects.filter(pk=row.pk).update(seller_unread=True, updated_at=now)
    row = Inquiry.objects.select_related('shop', 'product').prefetch_related('messages').get(pk=row.pk)
    return serialize(row, messages=True)


@transaction.atomic
def seller_reply(shop_id, payload):
    """A shop's reply: free text, and optionally whether the item is available and today's price for this buyer only."""
    if not isinstance(payload, dict):
        raise ValueError('Invalid reply')
    row = Inquiry.objects.select_for_update().filter(pk=str(payload.get('id') or ''), shop_id=shop_id).first()
    if not row:
        raise LookupError('Inquiry not found')
    available = payload.get('available')
    if available not in (True, False, None):
        raise ValueError('Availability must be yes, no or empty')
    raw_price = payload.get('price')
    price = parse_price(raw_price) if raw_price not in (None, '') else None
    if raw_price not in (None, '') and price is None:
        raise ValueError('Price must be in toman')
    if available is False:
        price = None
    text = _text(payload.get('text'), 500)
    if not text and available is None and price is None:
        raise ValueError('Write a reply')
    now = timezone.now()
    InquiryMessage.objects.create(inquiry=row, sender='seller', text=text, available=available, price=price, created_at=now)
    changes = dict(answered_at=now, updated_at=now, seller_unread=False, reply=text[:200] or row.reply)
    if available is not None:
        changes.update(available=available, price=price)
    elif price is not None:
        changes['price'] = price
    Inquiry.objects.filter(pk=row.pk).update(**changes)
    row = Inquiry.objects.select_related('shop', 'product').prefetch_related(Prefetch('messages')).get(pk=row.pk)
    return serialize(row, messages=True)


def record_miss(query):
    """Keep only the normalized text and a count; text that looks like a phone number is never stored."""
    text = normalize(query)[:80]
    if len(text) < 2 or re.search(r'\d{7,}', text):
        return
    try:
        updated = SearchMiss.objects.filter(pk=text).update(count=F('count') + 1, last_seen=timezone.now())
        if not updated:
            SearchMiss.objects.get_or_create(pk=text, defaults=dict(count=1, last_seen=timezone.now(), category=constraints(query)[3]))
    except DatabaseError:
        logger.warning('Could not record a search without results')  # the search answer itself must not fail
