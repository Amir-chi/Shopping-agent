"""The existing frontend's API contract, backed entirely by Django/PostgreSQL."""
import collections
import difflib
import json
from functools import lru_cache
from pathlib import Path
import re
import math

from django.conf import settings
from django.core.cache import cache
from django.contrib.postgres.search import SearchQuery
from django.db import connection
from django.db.models import Avg, Count, F, Max, Min, Q
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from .domain import (constraints, distance, garment_profile, normalize, opening,
                     nearest_station, origin_from, parse_price, plan_route, price_position, split_budget, tier_options, similar_options, usable_price, parsed)
from . import assistant, inquiries, web_prices
from .models import Metadata, Offer, OfferState, PriceEvent, Product, Shop
from .taxonomy import GROUPS, department, group_of, in_department, leaves, moved_out

GROUP_NAMES = {gid: name for gid, name, _ in GROUPS}
HAS_IMAGE = ~Q(raw__image_urls__in=['[]', 'null', ''])


# Aggregates over the whole catalog are cached under a version that any saved or deleted row bumps,
# so a merchant feed or new data is never hidden behind a stale count.
_catalog_version = 0


def _catalog_changed(**kwargs):
    global _catalog_version
    _catalog_version += 1


for _model in (Product, Shop, Offer):
    post_save.connect(_catalog_changed, sender=_model)
    post_delete.connect(_catalog_changed, sender=_model)


def catalog_cached(name, build, seconds):
    return cache.get_or_set(f'{name}:v{_catalog_version}', build, seconds)


def shop_product_counts():
    return catalog_cached('shop-product-counts', lambda: dict(
        Offer.objects.values('shop_id').annotate(n=Count('product_id', distinct=True)).values_list('shop_id', 'n')), 86400)


@lru_cache(maxsize=1)
def metro_stations():
    # OpenStreetMap snapshot (ODbL); refresh by re-exporting railway=station + station=subway for Tehran.
    return json.loads((Path(__file__).with_name('metro.json')).read_text(encoding='utf-8'))['stations']


def product(item):
    raw = item.raw
    return dict(id=item.pk, name=item.title, category=item.category, brand=item.brand,
                model=parsed(raw.get('model'), raw.get('model')) if raw.get('model') != 'null' else None,
                images=parsed(raw.get('image_urls'), []), specs=parsed(raw.get('specs'), []),
                price=item.low, high=item.high, stores=item.stores,
                outfit_slot=garment_profile(item.category)[0], url='/#product?id=' + item.pk,
                group=department(item.pk, item.category), group_name=GROUP_NAMES[department(item.pk, item.category)],
                bundle=item.category in BUNDLES)


def shop(item, origin=None):
    raw = item.raw
    website = raw.get('website_url')
    instagram = raw.get('instagram')
    website = None if website in ('', 'null', None) else website
    instagram = None if instagram in ('', 'null', None) else instagram
    hours = parsed(raw.get('weekly_hours'), {})
    return dict(id=item.pk, name=item.name, area=item.area, lat=item.lat, lon=item.lon,
                address=re.sub(r'\s*[,،]\s*', '، ', item.address).strip(), contacts=parsed(raw.get('contacts'), []),
                contacts_synthetic=True, name_synthetic=not bool(website or instagram),
                payments=parsed(raw.get('payment_options'), []), installment=item.installment,
                hours=hours, opening=opening(hours), categories=item.categories,
                website=website, instagram=instagram,
                fast_delivery=parsed(raw.get('supports_fast_delivery')),
                live_prices=item.pk in settings.MERCHANT_FEED_KEYS,
                metro=nearest_station(item.lat, item.lon, metro_stations()),
                distance_km=distance(*origin, item.lat, item.lon) if origin else None)


def state_fields(offer):
    state = getattr(offer, 'state', None)
    return dict(source=state.source if state else 'dataset',
                observed_at=state.observed_at.isoformat() if state else None,
                valid_until=state.valid_until.isoformat() if state else None,
                availability=state.availability if state else 'unknown',
                fresh=bool(state and state.valid_until > timezone.now()),
                product_url=state.product_url if state else None,
                reported_price=state.price_toman if state else None)


def pagination(args, default=12):
    return min(30, max(1, int(args.get('limit', default)))), min(300000, max(0, int(args.get('offset', 0))))


def title_words():
    """Words found in at least 20 product titles, for typo correction; cached until the catalog changes."""
    def load():
        with connection.cursor() as cursor:
            cursor.execute("SELECT word FROM ts_stat('SELECT search_document FROM catalog_product') WHERE ndoc >= 20")
            return sorted(row[0] for row in cursor.fetchall())
    return catalog_cached('title-words', load, 86400)


def spelled(term):
    """The closest common title word for a word no title uses; numbers and known words stay as they are."""
    words = title_words()
    if re.search(r'\d', term) or len(term) < 3 or term in set(words):
        return term
    return (difflib.get_close_matches(term, words, 1, 0.8) or [term])[0]


def search_products(args):
    text, inferred_max, inferred_installment, hint = constraints(args.get('q', ''))
    items = Product.objects.all()
    if args.get('group'):
        items = items.filter(in_department(args['group']))
        hint = None if hint and group_of(hint) != args['group'] else hint
    if args.get('with_images') == '1':
        items = items.filter(HAS_IMAGE)
    category = args.get('category') or hint
    if category:
        items = items.filter(category=category).exclude(pk__in=moved_out(category))
        if not args.get('category'):
            text = re.sub(r'\b(?:گوشی|موبایل|کتانی|کفش|اسپرت)\b', '', text).strip()
    maximum = int(args.get('max_price') or inferred_max or 0)
    minimum = int(args.get('min_price') or 0)
    if min(maximum, minimum) < 0 or max(maximum, minimum) > 10_000_000_000:
        raise ValueError('Invalid price range')
    installment = args.get('installment') == '1' or inferred_installment
    if maximum:
        items = items.filter(low__lte=maximum)
    if minimum:
        items = items.filter(high__gte=minimum)
    if installment or (maximum and minimum):
        qualifying = Offer.objects.filter(price__isnull=False)
        if installment:
            qualifying = qualifying.filter(shop__installment=True)
        if maximum:
            qualifying = qualifying.filter(price__lte=maximum)
        if minimum:
            qualifying = qualifying.filter(price__gte=minimum)
        items = items.filter(pk__in=qualifying.values('product_id'))
    relaxed, corrected = False, None
    if text:
        aliases = {'گلکسی': 'galaxy', 'galaxy': 'گلکسی', 'آیفون': 'iphone', 'iphone': 'آیفون',
                   'samsung': 'سامسونگ', 'سامسونگ': 'samsung'}
        # normalize() admits word tokens only; the tsquery is still passed as a SQL parameter.
        terms = normalize(text).split()[:12]
        word = lambda t: '(' + t + ':* | ' + aliases[t] + ':*)' if t in aliases else t + ':*'
        if terms:
            found = items.filter(search_document=SearchQuery(' & '.join(map(word, terms)), config='simple', search_type='raw'))
            # Titles often lack one word ("گلکسی"); any single word may be missing, never a model code with digits.
            droppable = [t for t in dict.fromkeys(terms) if not re.search(r'\d', t)] if len(terms) > 1 else []
            if droppable and args.get('exact') != '1' and not found.exists():
                loose = ' | '.join('(' + ' & '.join(word(x) for x in terms if x != t) + ')' for t in droppable)
                found = items.filter(search_document=SearchQuery(loose, config='simple', search_type='raw'))
                relaxed = True
            # A typo («سامسونگگ»): each unknown word becomes the closest word common in titles, then search again.
            if args.get('exact') != '1' and not found.exists():
                fixed = [spelled(t) for t in terms]
                if fixed != terms:
                    found = items.filter(search_document=SearchQuery(' & '.join(map(word, fixed)), config='simple', search_type='raw'))
                    corrected = ' '.join(fixed)
            items = found
    order = {'price': [F('low').asc(nulls_last=True)],
             'price_desc': [F('high').desc(nulls_last=True)],
             'stores': ['-stores', F('low').asc(nulls_last=True)]}.get(args.get('sort'), ['-stores', F('low').asc(nulls_last=True)])
    limit, offset = pagination(args)
    total = items.count()
    return dict(items=[product(p) for p in items.order_by(*order, 'id')[offset:offset + limit]],
                total=total, offset=offset,
                parsed=dict(search=text, max_price=inferred_max, installment=inferred_installment, category=hint, relaxed=relaxed, corrected=corrected))


def require_product(pid):
    try:
        return Product.objects.get(pk=pid)
    except Product.DoesNotExist:
        raise LookupError('Product not found') from None


def require_shop(sid):
    try:
        return Shop.objects.get(pk=sid)
    except Shop.DoesNotExist:
        raise LookupError('Shop not found') from None


def product_stores(pid, args):
    require_product(pid)
    origin = origin_from(args)
    offers = Offer.objects.filter(product_id=pid).select_related('shop', 'state').order_by(F('price').asc(nulls_last=True), 'id')
    found = {}
    for item in offers:
        if item.shop_id not in found:
            found[item.shop_id] = shop(item.shop, origin) | dict(offers=[], price=None, price_changed_at=None)
        entry = found[item.shop_id]
        data = {k: None if v == 'null' else v for k, v in item.raw.items()}
        data.update(valid_price=item.price, **state_fields(item))
        entry['offers'].append(data)
        if entry['price'] is None and item.price is not None:
            entry.update(price=item.price, price_changed_at=item.changed,
                         price_source=data['source'], observed_at=data['observed_at'],
                         valid_until=data['valid_until'], price_fresh=data['fresh'])
    counts = dict(Offer.objects.filter(shop_id__in=found).values('shop_id').annotate(n=Count('product_id', distinct=True)).values_list('shop_id', 'n'))
    for sid, entry in found.items():
        entry['product_count'] = counts.get(sid, 0)
    return dict(items=list(found.values()), total=len(found))


def price_check(pid, args):
    require_product(pid)
    # Without a quoted price this returns the recorded range only (the product page shows it unprompted).
    price = parse_price(args['price']) if args.get('price') else None
    if args.get('price') and price is None:
        raise ValueError('Enter a price in toman')
    # One price per shop, so a shop listing several offers does not outweigh the others.
    rows = list(Offer.objects.filter(product_id=pid, price__isnull=False).values('shop_id').annotate(low=Min('price'), changed=Max('changed')))
    prices = [r['low'] for r in rows if usable_price(r['low'])]
    if not prices:
        return dict(price=price, level='no_data', shops=0)
    dates = sorted(r['changed'] for r in rows if r['changed'])
    changes = dict(oldest_change=dates[0] if dates else None, newest_change=dates[-1] if dates else None)
    if price is None:
        ordered = sorted(prices)
        return dict(price=None, level=None, shops=len(ordered), low=ordered[0], median=ordered[(len(ordered) - 1) // 2], high=ordered[-1], **changes)
    return dict(price=price, **price_position(price, prices), **changes)


def route_plan(args):
    ids = list(dict.fromkeys(i for i in (args.get('ids') or '').split(',') if re.fullmatch(r'product_[a-zA-Z0-9]+', i)))
    if not 2 <= len(ids) <= 12:
        raise ValueError('Choose 2 to 12 products')
    origin = origin_from(args)
    items = {p.pk: p for p in Product.objects.filter(pk__in=ids)}
    prices, shops = {}, {}
    for offer in Offer.objects.filter(product_id__in=items, price__isnull=False).select_related('shop').iterator(chunk_size=500):
        if usable_price(offer.price) is None:
            continue
        best = prices.setdefault(offer.shop_id, {})
        best[offer.product_id] = min(offer.price, best.get(offer.product_id, offer.price))
        shops[offer.shop_id] = offer.shop
    # Declared closed right now (Tehran time); unknown hours stay usable and are labelled by the shop serializer.
    closed = {sid for sid, s in shops.items() if opening(parsed(s.raw.get('weekly_hours'), {}))['open'] is False}
    plans = plan_route(prices, {sid: (s.lat, s.lon) for sid, s in shops.items()}, origin, closed)
    serialized = {sid: shop(s, origin) for sid, s in shops.items() if any(sid == stop['shop'] for plan in plans for stop in plan['stops'])}
    for plan in plans:
        plan['stops'] = [stop | dict(shop=serialized[stop['shop']], items=[dict(product=product(items[pid]), price=price) for pid, price in stop['items']])
                         for stop in plan['stops']]
    carried = {pid for offers in prices.values() for pid in offers}
    return dict(plans=plans, missing=[product(items[pid]) for pid in ids if pid in items and pid not in carried],
                unknown=len(ids) - len(items), located=bool(origin))


# Dowry checklist over real leaf categories: (key, label, leaves, on by default).
DOWRY = [
    ('fridge', 'یخچال', ['یخچال فریزر بالاپایین', 'یخچال فریزر ساید بای ساید'], True), ('stove', 'اجاق گاز', ['اجاق گاز'], True),
    ('washer', 'ماشین لباسشویی', ['ماشین لباسشویی'], True), ('tv', 'تلویزیون', ['تلویزیون'], True),
    ('vacuum', 'جارو برقی', ['جارو برقی'], True), ('microwave', 'مایکروویو', ['مایکروویو'], True), ('iron', 'اتو', ['اتو'], True),
    ('rice', 'پلوپز', ['پلوپز و مولتی کوکر'], True), ('tea', 'چای‌ساز', ['چای ساز'], True), ('pot', 'قابلمه', ['قابلمه تکی'], True),
    ('carpet', 'فرش ماشینی', ['فرش ماشینی'], True), ('sofa', 'مبلمان', ['سایر مبلمان', 'مبل تخت‌خواب شو'], True),
    ('bed', 'تخت خواب', ['تخت خواب'], True), ('bedding', 'سرویس خواب', ['روتختی، لحاف و سرویس خواب'], True),
    ('dining', 'میز ناهارخوری', ['ست میز و صندلی غذاخوری'], True), ('dishwasher', 'ماشین ظرفشویی', ['ماشین ظرفشویی'], False),
    ('cooler', 'کولر گازی', ['کولر گازی'], False), ('curtain', 'پرده و رومیزی', ['رومیزی و پرده'], False),
]


DOWRY_GROUPS = ('home', 'appliances', 'digital', 'lighting')


NEAR_KM = 1.5


def nearby(args):
    """Shops within walking distance (straight line) of a point the buyer picked: up to 5 carrying products from the
    buyer's list, nearest first; when none does, the 3 nearest shops. Only recorded prices; nothing is stored."""
    origin = origin_from(args)
    if not origin:
        raise ValueError('Choose a point')
    lat, lon = origin
    box = Shop.objects.filter(lat__range=(lat - .014, lat + .014), lon__range=(lon - .017, lon + .017))
    close = {s.pk: s for s in box if distance(lat, lon, s.lat, s.lon) <= NEAR_KM}
    ids = [i for i in (args.get('ids') or '').split(',') if re.fullmatch(r'product_[a-zA-Z0-9]+', i)][:20]
    carries = collections.defaultdict(list)
    for o in Offer.objects.filter(shop_id__in=close, product_id__in=ids, price__isnull=False).select_related('product').order_by('price', 'id'):
        if usable_price(o.price) and all(x['id'] != o.product_id for x in carries[o.shop_id]):
            carries[o.shop_id].append(dict(id=o.product_id, name=o.product.title, price=o.price))
    far = {sid: distance(lat, lon, s.lat, s.lon) for sid, s in close.items()}
    order = sorted(close, key=lambda sid: (far[sid], sid))
    chosen = [sid for sid in order if carries[sid]][:5] or order[:3]
    return dict(radius_km=NEAR_KM, total=len(close), items=[shop(close[sid], origin) | dict(carries=carries[sid]) for sid in chosen])


def dowry_candidates(leaves):
    # ponytail: the 300 best-stocked listings per category, cached a day; enough for medians and three picks.
    def load():
        rows = Product.objects.filter(category__in=leaves, low__isnull=False).order_by('-stores', 'low', 'id').values_list('id', 'low', 'stores')[:300]
        return [r for r in rows if usable_price(r[1])]
    return cache.get_or_set('dowry:' + '|'.join(leaves), load, 86400)


def dowry(args):
    catalog = [dict(key=k, label=label, default=on) for k, label, _, on in DOWRY]
    if not args.get('budget'):
        return dict(catalog=catalog)
    budget = parse_price(args['budget'])
    if budget is None:
        raise ValueError('Enter a budget in toman')
    keys = set((args.get('items') or '').split(','))
    chosen, unmatched = [d for d in DOWRY if d[0] in keys], []
    # The buyer's own items (up to 5), searched only in household departments: each maps to a category whose name
    # holds the text, else to the most common category among the results.
    for text in list(dict.fromkeys(t.strip()[:40] for t in re.split('[,،]', args.get('extra') or '') if t.strip()))[:5]:
        found = [p['category'] for g in DOWRY_GROUPS for p in search_products({'q': text, 'group': g, 'limit': 30})['items'] if p.get('price')]
        found = [c for c in found if text in c] or found
        if found:
            chosen.append(('extra:' + text, text, [max(set(found), key=found.count)], False))
        else:
            unmatched.append(text)
    if not chosen:
        raise ValueError('Choose at least one item')
    candidates = {k: dowry_candidates(leaves) for k, _, leaves, _ in chosen}
    medians = {k: sorted(p for _, p, _ in rows)[(len(rows) - 1) // 2] for k, rows in candidates.items() if rows}
    shares = split_budget(budget, medians)
    picks = {k: tier_options(shares[k], candidates[k]) for k in shares}
    similar = {k: similar_options(shares[k], candidates[k], {o['product'] for o in picks[k]}) for k in shares}
    ids = [o['product'] for options in [*picks.values(), *similar.values()] for o in options]
    products = {p.pk: product(p) for p in Product.objects.filter(pk__in=ids)}
    items = [dict(key=k, label=label, share=shares[k], median=medians[k], cheapest=min(p for _, p, _ in candidates[k]),
                  options=[o | dict(product=products[o['product']]) for o in picks[k]],
                  similar=[o | dict(product=products[o['product']]) for o in similar[k]]) for k, label, _, _ in chosen if k in shares]
    tiers = {t: sum(next((o['price'] for o in i['options'] if o['tier'] == t), i['options'][-1]['price']) for i in items)
             for t in ('economy', 'balanced', 'better')}
    return dict(catalog=catalog, budget=budget, items=items, tiers=tiers, cheapest_total=sum(i['cheapest'] for i in items),
                missing=[label for k, label, _, _ in chosen if k not in shares] + unmatched)


def outfits(args):
    from .outfits import build
    return build(args)


def shop_products(item, args):
    """A storefront: every product the shop offers, with its own price, filterable by the shop's categories."""
    limit, offset = pagination(args, 24)
    offers = Offer.objects.filter(shop=item)
    facets = [dict(name=row['product__category'], count=row['n'], group=group_of(row['product__category']))
              for row in offers.values('product__category').annotate(n=Count('product_id', distinct=True)).order_by('-n', 'product__category')]
    if args.get('category'):
        offers = offers.filter(product__category=args['category'])
    if args.get('q'):
        offers = offers.filter(product__title__icontains=args['q'][:100])
    order = {'price': [F('price').asc(nulls_last=True)], 'price_desc': [F('price').desc(nulls_last=True)]}.get(args.get('sort'), ['product__title'])
    rows = list(offers.select_related('product').order_by(*order, 'id')[offset:offset + limit])
    items = [product(o.product) | dict(shop_price=o.price, shop_price_changed_at=o.changed, offer_id=o.pk) for o in rows]
    return dict(items=items, total=offers.count(), categories=facets, product_count=sum(f['count'] for f in facets))


def shop_previews(shop_ids):
    """Product counts and up to four product images per shop, for cards that show what a shop actually sells."""
    counts = shop_product_counts()
    previews = {}
    for sid in shop_ids:
        sample = Product.objects.filter(HAS_IMAGE, offers__shop_id=sid).distinct().order_by('-stores', 'id')[:4]
        previews[sid] = dict(product_count=counts.get(sid, 0),
                             samples=[dict(id=p.pk, name=p.title, image=(parsed(p.raw.get('image_urls'), []) or [None])[0]) for p in sample])
    return previews


def home_feed():
    """Departments with real counts plus product rails. Building it scans the whole catalog (~15 s on one CPU),
    so it is rebuilt only when catalog data changes, not on a timer."""
    # ponytail: the version counter is per process; a sync_feed run outside the web process waits for a restart or the 7-day cap.
    return catalog_cached('home-feed', build_home_feed, 7 * 86400)


def build_home_feed():
    per_leaf = dict(Product.objects.values_list('category').annotate(n=Count('pk')))
    groups = []
    for gid, name, icon in GROUPS:
        members = sorted(((leaf, n) for leaf, n in per_leaf.items() if group_of(leaf) == gid), key=lambda x: -x[1])
        if members:
            groups.append(dict(id=gid, name=name, icon=icon, count=sum(n for _, n in members),
                               leaves=[dict(name=leaf, count=n) for leaf, n in members]))

    def rail(query):
        # Home cards need one image, not dozens of full specification rows per item.
        # The product/compare routes fetch the complete product before displaying it.
        previews = [product(p) for p in Product.objects.filter(HAS_IMAGE, low__isnull=False).filter(query).order_by('-stores', 'low', 'id')[:12]]
        return [p | dict(specs=[], images=p['images'][:1]) for p in previews]
    rails = [dict(id='popular', title='پرپیشنهادترین کالاها', subtitle='کالاهایی که بیشترین فروشگاه برایشان قیمت ثبت کرده‌اند',
                  group=None, items=rail(Q()))]
    for group in [g for g in groups if g['id'] != 'other'][:8]:
        rails.append(dict(id=group['id'], title=group['name'], subtitle=None, count=group['count'], group=group['id'],
                          items=rail(in_department(group['id']))))
    return dict(groups=groups, rails=[r for r in rails if r['items']])


# Complementary categories: the outfit idea applied to other goods ("what else will I need with this?").
BUNDLES = {
    'گوشی موبایل': ['کیف و کاور گوشی', 'محافظ صفحه نمایش گوشی', 'شارژر گوشی', 'پاوربانک و شارژر همراه', 'هدفون، هدست و هندزفری', 'محافظ لنز دوربین گوشی'],
    'تبلت': ['کیف و کاور تبلت', 'پایه نگهدارنده گوشی و تبلت', 'شارژر گوشی', 'هدفون، هدست و هندزفری'],
    'لپ تاپ و نوت بوک': ['ماوس', 'کیف و کاور لپ تاپ', 'فلش مموری', 'هارد دیسک اینترنال', 'هدفون، هدست و هندزفری'],
    'دوربین عکاسی و فیلمبرداری': ['کارت حافظه', 'لنز دوربین', 'پایه نور و دوربین', 'کیف و کاور تجهیزات فیلمبرداری'],
    'دوربین مدار بسته': ['ضبط کننده ویدیویی دوربین‌های نظارتی و امنیتی', 'هارد دیسک اینترنال', 'کابل شبکه', 'کابل کواکسیال'],
    'تلویزیون': ['پایه تلویزیون', 'کابل و تبدیل HDMI', 'اسپیکر و سیستم صوتی'],
    'ساعت و مچ بند هوشمند': ['شارژر وایرلس و پایه شارژ', 'هدفون، هدست و هندزفری'],
    'پرینتر لیزری و چند کاره': ['کارتریج پرینتر'],
    'هدفون، هدست و هندزفری': ['کیف و کاور هدفون و هندزفری', 'شارژر گوشی'],
    'عطر و ادکلن': ['مام و اسپری'],
}


# Accessories that fit one model only: offered only when their title names the product's model (every word of it).
FITTED = {'کیف و کاور گوشی', 'محافظ صفحه نمایش گوشی', 'کیف و کاور تبلت', 'لنز دوربین', 'کارتریج پرینتر',
          'کیف و کاور هدفون و هندزفری'}


def accessory_filter(item, roles, prefix=''):
    """Q for accessories of these roles that can go with the item; fitted roles need its model in their title."""
    model = item.raw.get('model')
    words = normalize(model).split() if model and model != 'null' else []
    allowed = Q(**{prefix + 'category__in': [r for r in roles if r not in FITTED]})
    if words:
        named = SearchQuery(' & '.join(w + ':*' for w in words), config='simple', search_type='raw')
        allowed |= Q(**{prefix + 'category__in': [r for r in roles if r in FITTED], prefix + 'search_document': named})
    return allowed


def bundle(pid, args):
    """Complements for a product, preferring one shop that has the product and the most accessories."""
    item = require_product(pid)
    roles = BUNDLES.get(item.category, [])
    if not roles:
        return dict(roles=[], one_stop=None, options={})
    origin = origin_from(args)
    fits = accessory_filter(item, roles, 'product__')
    sellers = Offer.objects.filter(product=item, price__isnull=False)
    pairs = set(Offer.objects.filter(fits, shop_id__in=sellers.values('shop_id'), price__isnull=False)
                .values_list('shop_id', 'product__category'))
    coverage = collections.Counter(sid for sid, _ in pairs)
    one_stop = None
    if coverage:
        cheapest = dict(sellers.values('shop_id').annotate(low=Min('price')).values_list('shop_id', 'low'))
        sid = max(coverage, key=lambda k: (coverage[k], -cheapest[k]))
        base = sellers.filter(shop_id=sid).select_related('shop').order_by('price', 'id').first()
        picks = []
        for role in roles:
            offer = Offer.objects.filter(fits, shop_id=sid, product__category=role, price__isnull=False).select_related('product').order_by('price', 'id').first()
            if offer:
                picks.append(dict(role=role, product=product(offer.product), price=offer.price, offer_id=offer.pk))
        one_stop = dict(shop=shop(base.shop, origin), base_price=base.price, items=picks,
                        total=base.price + sum(p['price'] for p in picks),
                        missing=[r for r in roles if r not in {p['role'] for p in picks}])
    allowed = accessory_filter(item, roles)
    options = {role: [product(p) for p in Product.objects.filter(allowed, HAS_IMAGE, category=role, low__isnull=False).order_by('-stores', 'low', 'id')[:6]]
               for role in roles}
    return dict(roles=roles, one_stop=one_stop, options=options,
                note='قاب، محافظ و مانند آن فقط وقتی پیشنهاد می‌شوند که نام همین مدل در عنوانشان باشد؛ باز هم سازگاری را از فروشنده بپرس.')


def market_fallback(args):
    q = normalize(args.get('q', ''))
    category = args.get('category') or constraints(q)[3]
    all_categories = list(Product.objects.values_list('category', flat=True).distinct())
    if category and category not in all_categories:
        raise ValueError('Unknown category')
    if category:
        categories = [category]
    else:
        tokens = [t for t in q.split() if t not in ('خرید', 'مدل', 'برای', 'ارزان', 'مناسب') and len(t) > 2]
        scored = [(sum(t in normalize(c).split() for t in tokens), c) for c in all_categories]
        categories = [c for score, c in sorted(scored, reverse=True) if score][:8]
    if not categories:
        return dict(items=[], categories=[], reason='دسته کالا مشخص نیست؛ دسته‌بندی را انتخاب کن.')
    related = Q(pk__in=Offer.objects.filter(product__category__in=categories).values('shop_id'))
    for cat in categories:
        related |= Q(categories__contains=[cat])
    rows = list(Shop.objects.filter(related).order_by('id'))
    related_ids = {r.pk for r in rows}
    origin = origin_from(args)
    groups = collections.defaultdict(list)
    for row in rows:
        if args.get('installment') == '1' and not row.installment:
            continue
        groups[(math.floor(row.lat / .008), math.floor(row.lon / .010))].append(row)
    result = []
    for members in groups.values():
        if len(members) < 2:
            continue
        lat, lon = (sum(getattr(r, k) for r in members) / len(members) for k in ('lat', 'lon'))
        area = collections.Counter(r.area for r in members).most_common(1)[0][0]
        result.append(dict(id='cluster-' + members[0].pk, name='محدوده ' + area,
                           lat=lat, lon=lon, area=area, shop_count=len(members), categories=categories,
                           source='dataset_cluster', source_url=None,
                           detail='تجمع فروشگاه‌های ثبت‌شدهٔ مرتبط؛ موجودی مدل یا بودجه شما تأیید نشده.',
                           location_basis='مرکز تقریبی تجمع فروشگاه‌ها',
                           distance_km=distance(*origin, lat, lon) if origin else None,
                           shops=[shop(r, origin) for r in members[:3]]))
    guide = json.loads((settings.BASE_DIR / 'market-guide.json').read_text(encoding='utf-8'))
    for entry in guide:
        if args.get('installment') == '1' or not any(any(re.search(r'\b' + re.escape(normalize(token)) + r'\b', normalize(c)) for token in entry['category_keywords']) for c in categories):
            continue
        anchors = list(Shop.objects.filter(address__contains=entry['address_anchor']).order_by('id'))
        if not anchors:
            continue
        lat, lon = (sum(getattr(r, k) for r in anchors) / len(anchors) for k in ('lat', 'lon'))
        result.append(dict(id=entry['id'], name=entry['name'], lat=lat, lon=lon, area=anchors[0].area,
                           categories=categories, shop_count=None, source='curated_guide', source_url=entry['source_url'],
                           detail=entry['detail'], checked_at=entry['checked_at'],
                           location_basis='مرکز تقریبی فروشگاه‌های دارای همین نشانی',
                           distance_km=distance(*origin, lat, lon) if origin else None,
                           shops=[shop(r, origin) for r in anchors if r.pk in related_ids][:3]))
    result.sort(key=lambda x: (x['source'] != 'curated_guide', x['distance_km'] if origin else -(x['shop_count'] or 0)))
    return dict(items=result[:4], categories=categories, reason='این‌ها محل جست‌وجوی حضوری‌اند؛ وجود کالای دقیق تأیید نشده است.')


def bootstrap():
    areas = [dict(name=row['area'], lat=row['lat'], lon=row['lon'], count=row['count']) for row in
             Shop.objects.exclude(area__in=['', 'null']).values('area').annotate(lat=Avg('lat'), lon=Avg('lon'), count=Count('pk')).order_by('-count', 'area')]
    categories = list(Product.objects.values(name=F('category')).annotate(count=Count('pk')).order_by('-count', 'name'))
    metadata = dict(Metadata.objects.values_list('key', 'value'))
    return dict(counts=dict(products=Product.objects.count(), offers=Offer.objects.count(), shops=Shop.objects.count()),
                areas=areas, categories=categories, featured=search_products({'category': 'گوشی موبایل', 'limit': 3})['items'],
                imported_at=metadata.get('imported_at'), snapshot_latest_price=metadata.get('snapshot_latest_price'),
                data_notice=dict(phones_synthetic=True, shops_sample_percent=10, max_products_per_shop=300))


def endpoint(path, args):
    if path == '/api/video-reviews':
        from .video_reviews import reviews
        return reviews(args)
    if path == '/api/gift':
        return assistant.gift(args)
    if path == '/api/explain-specs':
        return assistant.explain(args)
    if path == '/api/dowry':
        return dowry(args)
    if path == '/api/route-plan':
        return route_plan(args)
    if path == '/api/outfits':
        return outfits(args)
    if path == '/api/market-fallback':
        return market_fallback(args)
    if path == '/api/price-status':
        status = OfferState.objects.aggregate(offers=Count('offer_id'), shops=Count('offer__shop_id', distinct=True), latest=Max('observed_at'))
        return dict(connected_shops=status['shops'], updated_offers=status['offers'], latest_observation=status['latest'],
                    mode='merchant_feed' if status['shops'] else 'dataset_only')
    match = re.fullmatch(r'/api/offers/(offer_[a-zA-Z0-9]+)/history', path)
    if match:
        offer = Offer.objects.filter(pk=match[1]).first()
        if not offer:
            raise LookupError('Offer not found')
        events = list(PriceEvent.objects.filter(offer=offer).order_by('-observed_at').values('price_toman', 'availability', 'observed_at', 'valid_until')[:20])
        return dict(snapshot_price=offer.raw.get('price_toman'), snapshot_changed_at=offer.raw.get('last_price_changed_at'), events=events)
    if path == '/api/bootstrap':
        return catalog_cached('bootstrap', bootstrap, 600)
    if path == '/api/products':
        found = search_products(args)
        if not found['total'] and args.get('q') and not args.get('offset'):
            inquiries.record_miss(args['q'])
        return found
    if path == '/api/inquiries':
        return inquiries.for_buyer(args)
    if path == '/api/home':
        return home_feed()
    if path == '/api/assistant':
        return assistant.ask(args)
    if path == '/api/compare-insight':
        return assistant.compare(args)
    match = re.fullmatch(r'/api/products/(product_[a-zA-Z0-9]+)/bundle', path)
    if match:
        return bundle(match[1], args)
    match = re.fullmatch(r'/api/products/(product_[a-zA-Z0-9]+)/web-prices', path)
    if match:
        return web_prices.lookup(require_product(match[1]))
    match = re.fullmatch(r'/api/products/(product_[a-zA-Z0-9]+)/price-check', path)
    if match:
        return price_check(match[1], args)
    match = re.fullmatch(r'/api/products/(product_[a-zA-Z0-9]+)(/stores)?', path)
    if match:
        return product_stores(match[1], args) if match[2] else product(require_product(match[1]))
    if path == '/api/nearby':
        return nearby(args)
    if path == '/api/now':
        from .now import decide
        return decide(args)
    if path == '/api/shops':
        items = Shop.objects.all()
        if args.get('area'):
            items = items.filter(area=args['area'])
        if args.get('q'):
            items = items.filter(Q(name__icontains=args['q'][:100]) | Q(area__icontains=args['q'][:100]))
        if args.get('installment') == '1':
            items = items.filter(installment=True)
        limit, offset = pagination(args)
        # Shops with real catalogs first; empty listings still appear, after them. Counts come from the daily cache.
        counts = shop_product_counts()
        ids = sorted(items.values_list('id', 'name'), key=lambda r: (-counts.get(r[0], 0), r[1], r[0]))
        chosen = [sid for sid, _ in ids[offset:offset + limit]]
        found = Shop.objects.in_bulk(chosen)
        previews = shop_previews(chosen)
        return dict(items=[shop(found[sid]) | previews[sid] for sid in chosen], total=len(ids))
    match = re.fullmatch(r'/api/shops/(shop_[a-zA-Z0-9]+)(/products)?', path)
    if match:
        item = require_shop(match[1])
        if match[2]:
            return shop_products(item, args)
        return shop(item, origin_from(args))
    raise LookupError('Endpoint not found')
