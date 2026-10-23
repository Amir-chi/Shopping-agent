"""Transactional, shop-scoped observations; archived dataset records never change."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from django.db import transaction
from django.db.models import Count, Max, Min

from .models import Offer, OfferState, PriceEvent, Product


def timestamp(value):
    try:
        result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if result.tzinfo is None:
            raise ValueError()
        return result.astimezone(timezone.utc)
    except (TypeError, ValueError):
        raise ValueError('Use ISO timestamps with a timezone') from None


@transaction.atomic
def ingest(shop_id, payload):
    rows = payload.get('offers') if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not 1 <= len(rows) <= 500:
        raise ValueError('Provide 1..500 offers')
    if any(not isinstance(row, dict) or not isinstance(row.get('offer_id'), str) for row in rows):
        raise ValueError('Each offer must include an offer_id')
    ids = [row['offer_id'] for row in rows]
    offers = {o.pk: o for o in Offer.objects.filter(pk__in=ids, shop_id=shop_id)}
    if len(offers) != len(set(ids)):
        raise ValueError('Offer does not belong to this shop')
    now = datetime.now(timezone.utc)
    prepared = []
    for row in rows:
        price, availability = row.get('price_toman'), row.get('availability')
        if type(price) is not int or not 1000 <= price <= 10_000_000_000:
            raise ValueError('price_toman must be an integer in toman between 1000 and 10000000000')
        if availability not in ('in_stock', 'out_of_stock', 'unknown'):
            raise ValueError('Invalid availability')
        observed = timestamp(row.get('observed_at'))
        until = timestamp(row['valid_until']) if row.get('valid_until') else observed + timedelta(hours=6)
        if observed > now + timedelta(minutes=5) or not observed < until <= observed + timedelta(days=1):
            raise ValueError('Invalid observation time or validity period')
        url = row.get('product_url') or None
        if url is not None:
            if not isinstance(url, str) or len(url) > 2000:
                raise ValueError('Invalid product_url')
            parts = urlsplit(url)
            if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
                raise ValueError('product_url must be HTTPS without credentials')
        data = dict(offer_id=row['offer_id'], shop_id=shop_id, price_toman=price, availability=availability,
                    observed_at=observed.isoformat(), valid_until=until.isoformat(), product_url=url)
        event_id = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        prepared.append((event_id, data, observed, until))
    # Lock products first in a stable order: concurrent shops cannot lose aggregate updates.
    pids = sorted({o.product_id for o in offers.values()})
    list(Product.objects.select_for_update().filter(pk__in=pids).order_by('pk'))
    offers = {o.pk: o for o in Offer.objects.select_for_update().filter(pk__in=ids).order_by('pk')}
    applied = duplicate = older = 0
    changed_products = set()
    for event_id, data, observed, until in prepared:
        offer = offers[data['offer_id']]
        values = dict(offer=offer, shop_id=shop_id, price_toman=data['price_toman'], availability=data['availability'],
                      observed_at=observed, valid_until=until, received_at=now, product_url=data['product_url'])
        _, created = PriceEvent.objects.get_or_create(pk=event_id, defaults=values)
        if not created:
            duplicate += 1
            continue
        current = OfferState.objects.filter(offer=offer).first()
        if current and current.observed_at >= observed:
            older += 1
            continue
        OfferState.objects.update_or_create(offer=offer, defaults=dict(
            price_toman=data['price_toman'], availability=data['availability'], observed_at=observed,
            valid_until=until, product_url=data['product_url'], source='merchant_feed', event_id=event_id))
        price = None if data['availability'] == 'out_of_stock' else data['price_toman']
        if offer.price != price:
            offer.changed = observed.isoformat()
        offer.price = price
        offer.save(update_fields=['price', 'changed'])
        changed_products.add(offer.product_id)
        applied += 1
    for pid in sorted(changed_products):
        totals = Offer.objects.filter(product_id=pid).aggregate(low=Min('price'), high=Max('price'), stores=Count('shop_id', distinct=True))
        Product.objects.filter(pk=pid).update(**totals)
    return dict(applied=applied, duplicate=duplicate, ignored_older=older, affected_products=len(changed_products))
