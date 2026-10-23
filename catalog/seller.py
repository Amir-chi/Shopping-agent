"""Seller panel: per-shop login, dashboard, conversations with buyers, the shop's products and its own price updates.

A shop logs in with an access code an admin issued (`manage.py seller_code`); codes and session tokens are stored only
as hashes. SELLER_DEMO=true also allows a code-free demo login for presentations. A demo session can read and answer
messages but can never change public prices or stock."""
import hashlib
import hmac
import os
import re
import secrets
import statistics
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from . import inquiries, prices
from .models import Inquiry, Offer, OfferState, SearchMiss, SellerAccess, SellerSession, Shop

ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'  # no 0/o, 1/l/i: codes are read aloud and typed on phones
SESSION_DAYS, DEMO_HOURS = 14, 12


class Unauthorized(Exception):
    """No valid panel session for this shop."""


class DemoForbidden(Exception):
    """A demo session tried to change public data."""


def _hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def demo_enabled():
    return os.environ.get('SELLER_DEMO', 'false').lower() == 'true'


def demo_shops():
    """One well-stocked real shop per familiar department, offered as one-tap demo logins when presenting the panel."""
    from .services import catalog_cached
    from .taxonomy import GROUPS, group_of
    names = {gid: name for gid, name, _ in GROUPS}
    order = ['mobile', 'digital', 'appliances', 'fashion', 'home', 'beauty', 'sports', 'kids']

    def build():
        rows = list(Offer.objects.values('shop_id').annotate(n=Count('product_id', distinct=True)).order_by('-n', 'shop_id')[:600])
        shops = {s.pk: s for s in Shop.objects.filter(pk__in=[r['shop_id'] for r in rows])}
        best = {}
        for r in rows:
            shop = shops[r['shop_id']]
            dept = group_of((shop.categories or [''])[0])
            # Shops with a website or Instagram first: their names are less likely to be synthetic.
            known = any(shop.raw.get(k) not in (None, '', 'null') for k in ('website_url', 'instagram'))
            rank = (not known, -r['n'], shop.pk)
            if dept in order and (dept not in best or rank < best[dept][0]):
                best[dept] = (rank, dict(id=shop.pk, name=shop.name, area=shop.area, trade=names[dept], products=r['n']))
        return [best[d][1] for d in order if d in best]
    return catalog_cached('seller-demo-shops', build, 86400)


def issue_code(shop_id):
    shop = Shop.objects.get(pk=shop_id)
    code = ''.join(secrets.choice(ALPHABET) for _ in range(10))
    SellerAccess.objects.update_or_create(shop=shop, defaults=dict(code_hash=_hash(code), created_at=timezone.now()))
    SellerSession.objects.filter(shop=shop).delete()  # a new code signs out every earlier session
    return code


def login(payload):
    if not isinstance(payload, dict) or not re.fullmatch(r'shop_[a-zA-Z0-9]+', str(payload.get('shop_id') or '')):
        raise ValueError('Choose a shop')
    shop = Shop.objects.filter(pk=payload['shop_id']).first()
    if not shop:
        raise LookupError('Shop not found')
    demo = payload.get('demo') is True
    if demo:
        if not demo_enabled():
            raise Unauthorized('Demo login is off')
    else:
        code = re.sub(r'[\s-]', '', str(payload.get('code') or '')).lower()
        access = SellerAccess.objects.filter(shop=shop).first()
        if not access or not code or not hmac.compare_digest(access.code_hash, _hash(code)):
            raise Unauthorized('Wrong code')
    now, token = timezone.now(), secrets.token_urlsafe(32)
    SellerSession.objects.filter(expires_at__lt=now).delete()
    SellerSession.objects.create(token_hash=_hash(token), shop=shop, demo=demo,
                                 expires_at=now + (timedelta(hours=DEMO_HOURS) if demo else timedelta(days=SESSION_DAYS)))
    return dict(token=token, demo=demo, shop=dict(id=shop.id, name=shop.name, area=shop.area))


def session(authorization, shop_id):
    token = authorization[7:] if authorization.startswith('Bearer ') else ''
    found = SellerSession.objects.filter(token_hash=_hash(token), expires_at__gt=timezone.now()).select_related('shop').first() if token else None
    if not found or found.shop_id != shop_id:
        raise Unauthorized('Sign in again')
    return found


def logout(authorization):
    token = authorization[7:] if authorization.startswith('Bearer ') else ''
    if token:
        SellerSession.objects.filter(token_hash=_hash(token)).delete()
    return dict(ok=True)


def overview(s, args=None):
    shop, now = s.shop, timezone.now()
    recent = Inquiry.objects.filter(shop=shop, created_at__gte=now - inquiries.KEEP)
    waits = [(a - c).total_seconds() / 60 for c, a in recent.filter(answered_at__isnull=False).values_list('created_at', 'answered_at')]
    offers = Offer.objects.filter(shop=shop)
    categories = set(shop.categories or [])
    # A search only reaches a seller once at least two people made it, so no single shopper's query is shown.
    misses = list(SearchMiss.objects.filter(count__gte=2, last_seen__gte=now - timedelta(days=30)).order_by('-count', 'query')[:200])
    unmet = (Inquiry.objects.filter(created_at__gte=now - inquiries.KEEP, available=False, product__category__in=categories).exclude(shop=shop)
             .values('product_id', 'product__title').annotate(n=Count('id')).order_by('-n', 'product_id')[:10])
    stocked = set(offers.filter(product_id__in=[u['product_id'] for u in unmet]).values_list('product_id', flat=True))
    latest = recent.filter(seller_unread=True).select_related('shop', 'product').order_by('-updated_at', '-created_at')[:3]
    return dict(shop=dict(id=shop.id, name=shop.name, area=shop.area, categories=sorted(categories)[:20]), demo=s.demo,
                stats=dict(received=recent.count(), unread=recent.filter(seller_unread=True).count(), answered=len(waits),
                           median_minutes=round(statistics.median(waits)) if waits else None,
                           products=offers.values('product_id').distinct().count(),
                           live=OfferState.objects.filter(offer__shop=shop, valid_until__gt=now).count()),
                latest=[inquiries.serialize(r) for r in latest],
                demand=dict(searches=[dict(query=m.query, count=m.count) for m in misses if m.category in categories][:10],
                            other_searches=[dict(query=m.query, count=m.count) for m in misses if m.category not in categories][:10],
                            unmet=[dict(product=dict(id=u['product_id'], name=u['product__title']), count=u['n'], in_your_shop=u['product_id'] in stocked)
                                   for u in unmet]))


def conversations(s, args):
    rows = Inquiry.objects.filter(shop=s.shop, created_at__gte=timezone.now() - inquiries.KEEP)
    status = args.get('status') or 'all'
    if status == 'unread':
        rows = rows.filter(seller_unread=True)
    elif status == 'answered':
        rows = rows.filter(answered_at__isnull=False)
    elif status != 'all':
        raise ValueError('Unknown filter')
    rows = rows.select_related('shop', 'product').order_by('-seller_unread', '-updated_at', '-created_at')[:60]
    return dict(items=[inquiries.serialize(r) for r in rows])


def thread(s, args):
    row = (Inquiry.objects.filter(shop=s.shop, pk=str(args.get('id') or ''), created_at__gte=timezone.now() - inquiries.KEEP)
           .select_related('shop', 'product').prefetch_related('messages').first())
    if not row:
        raise LookupError('Conversation not found')
    if row.seller_unread:
        Inquiry.objects.filter(pk=row.pk).update(seller_unread=False)
        row.seller_unread = False
    data = inquiries.serialize(row, messages=True)
    offer = Offer.objects.filter(shop=s.shop, product_id=row.product_id, price__isnull=False).order_by('price').first() if row.product_id else None
    data['your_price'] = offer.price if offer else None
    return data


def reply(s, payload):
    return inquiries.seller_reply(s.shop_id, payload)


def products(s, args):
    from .services import pagination, product, state_fields
    offers = Offer.objects.filter(shop=s.shop).select_related('product', 'state')
    if args.get('q'):
        offers = offers.filter(product__title__icontains=str(args['q'])[:100])
    if args.get('category'):
        offers = offers.filter(product__category=args['category'])
    facets = list(Offer.objects.filter(shop=s.shop).values('product__category').annotate(n=Count('product_id', distinct=True)).order_by('-n')[:20])
    limit, offset = pagination(args, 20)
    total = offers.count()
    items = []
    for offer in offers.order_by('product__title', 'id')[offset:offset + limit]:
        p = product(offer.product)
        items.append(dict(offer_id=offer.pk, price=offer.price, changed_at=offer.changed or None,
                          product=dict(id=p['id'], name=p['name'], category=p['category'], images=p['images'][:1], low=p['price'], stores=p['stores']),
                          **state_fields(offer)))
    return dict(items=items, total=total, offset=offset, categories=[dict(name=f['product__category'], count=f['n']) for f in facets])


def update_price(s, payload):
    """The shop's own observation for one of its offers, through the same validated path as the merchant feed."""
    if s.demo:
        raise DemoForbidden('Demo sessions cannot change public prices')
    if not isinstance(payload, dict):
        raise ValueError('Invalid update')
    offer = Offer.objects.filter(shop=s.shop, pk=str(payload.get('offer_id') or '')).first()
    if not offer:
        raise LookupError('Offer not found')
    availability = payload.get('availability')
    if availability not in ('in_stock', 'out_of_stock'):
        raise ValueError('Choose in stock or out of stock')
    price = prices_from(payload.get('price'), offer)
    now = timezone.now()
    result = prices.ingest(s.shop_id, dict(offers=[dict(offer_id=offer.pk, price_toman=price, availability=availability,
                                                        observed_at=now.isoformat(), valid_until=(now + timedelta(hours=24)).isoformat())]))
    return result


def prices_from(value, offer):
    from .domain import parse_price
    if value in (None, ''):
        if offer.price is None:
            raise ValueError('Enter today\'s price')
        return offer.price
    price = parse_price(value)
    if price is None:
        raise ValueError('Price must be in toman')
    return price
