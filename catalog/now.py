"""«همین الان»: one decision for an in-person need, at a place and an hour.

From the request text the catalog search finds what kind of product it is (its leaf categories). Then every shop that
records an offer in those categories, or lists the category in its profile, is checked against its declared weekly
hours at the chosen time: open now, closed (and when it opens next), or unknown. Shops are grouped into nearby areas so
the answer can say «you are near X, where more shops of this kind cluster», with the honest caveat that a shop there
may be open without being in the dataset. Rules only, no AI; distances are straight lines, prices are recorded ones.
"""
import collections
import json
import re
from datetime import datetime, timedelta

from django.db.models import Q

from .domain import TEHRAN, distance, next_opening, opening, origin_from, parsed, usable_price
from .models import Offer, Shop

NEAR_KM = 2.0      # within this, a shop counts as near
REACH_KM = 12.0    # open shops farther than this are not worth the trip at night
HUB_KM = 3.0       # an area this close may be worth trying
DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']


def moment(args):
    """The time to judge: now in Tehran, or a demo time ('at' = HH:MM, 'day' = mon…sun, the next such day)."""
    now = datetime.now(TEHRAN)
    if args.get('day'):
        if args['day'] not in DAYS:
            raise ValueError('Unknown day')
        now += timedelta(days=(DAYS.index(args['day']) - now.weekday()) % 7)
    if args.get('at'):
        hour, minute = (int(x) for x in str(args['at']).split(':'))
        if not (0 <= hour < 24 and 0 <= minute < 60):
            raise ValueError('Invalid time')
        now = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return now


FILLER = re.compile(r'(?:^|\s)(?:می‌?خوام|میخوام|می خوام|لازم|دارم|یه|یک|همین|الان|برای|من|یکی|کجا|پیدا|کنم)(?=\s|$)')


PICKER = ('You map a Persian shopping request to the product categories of an Iranian catalog. You get the request and the '
          'exact category names of one department. Pick up to 3 names that contain what the shopper means (for «لباس گرم» '
          'coats, jackets, sweaters; not underwear or hospital gowns). Copy names exactly from the list. '
          'Return JSON {"categories": [names]}; an empty list when none fits.')


def kind_of(query):
    """Leaf categories the request is about. The router model names the department, then a second short call picks up to
    3 categories from that department's real list (so «لباس گرم میخوام» means coats and sweaters, not a category whose
    name happens to contain «لباس»); both answers are cached a day per request. Plain search is the fallback."""
    from . import ai
    from .assistant import ROUTER
    from .services import search_products
    from .taxonomy import GROUP_IDS, leaves
    try:
        route = ai.chat_json(ROUTER, query, router=True, timeout=15, cache_seconds=86400)
        if route.get('shopping') is False:
            return [], []
        if route.get('department') in GROUP_IDS:
            names = leaves(route['department'])
            picked = ai.chat_json(PICKER, json.dumps(dict(request=query, categories=names), ensure_ascii=False),
                                  router=True, timeout=20, cache_seconds=86400).get('categories') or []
            chosen = [c for c in dict.fromkeys(picked) if c in set(names)][:3]
            if chosen:
                return chosen, []
    except ai.Unavailable:
        pass
    found = search_products({'q': FILLER.sub(' ', query).strip() or query, 'limit': 30})['items']
    counts = collections.Counter(p['category'] for p in found)
    if not counts:
        return [], found
    top = counts.most_common(1)[0][1]
    return [c for c, n in counts.most_common(3) if n * 2 >= top], found


def decide(args):
    from .services import shop
    query = str(args.get('q') or '').strip()[:120]
    if len(query) < 2:
        raise ValueError('Say what you need')
    origin = origin_from(args)
    if not origin:
        raise ValueError('Choose where you are')
    when = moment(args)
    categories, found = kind_of(query)
    if not categories:
        return dict(query=query, categories=[], time=when.strftime('%H:%M'), kind='unknown_item', open=[], closed=[], unknown=[], hub=None)
    lat, lon = origin
    span = REACH_KM / 111
    box = Q(lat__range=(lat - span, lat + span), lon__range=(lon - span * 1.25, lon + span * 1.25))
    cheapest = {}
    for o in Offer.objects.filter(product__category__in=categories, price__isnull=False, shop__in=Shop.objects.filter(box)) \
            .select_related('product').order_by('price', 'id'):
        if usable_price(o.price) and o.shop_id not in cheapest:
            cheapest[o.shop_id] = o
    listed = Q()
    for c in categories:
        listed |= Q(categories__contains=[c])
    shops = list(Shop.objects.filter(box).filter(Q(pk__in=list(cheapest)) | listed))
    rows = []
    for s in shops:
        hours = parsed(s.raw.get('weekly_hours'), {})
        state = opening(hours, when)
        nxt = next_opening(hours, when) if state['open'] is False else None
        o = cheapest.get(s.pk)
        rows.append(dict(shop=s, km=distance(lat, lon, s.lat, s.lon), open=state['open'], label=state['label'], next=nxt,
                         offer=dict(product=dict(id=o.product_id, name=o.product.title), price=o.price) if o else None))

    def card(r):
        return shop(r['shop'], origin) | dict(state=r['open'], hours_label=r['label'], next_open=r['next'][2] if r['next'] else None,
                                              offer=r['offer'])
    by_km = sorted(rows, key=lambda r: (r['km'], r['offer'] is None))
    open_rows = [r for r in by_km if r['open']]
    closed = [r for r in by_km if r['open'] is False and r['km'] <= NEAR_KM]
    unknown = [r for r in by_km if r['open'] is None and r['km'] <= NEAR_KM]
    hub = nearby_hub(rows, lat, lon)
    nearest_open = open_rows[0]['km'] if open_rows else None
    kind = ('open_near' if nearest_open is not None and nearest_open <= NEAR_KM else
            'open_far' if nearest_open is not None else 'none_open')
    soonest = min((r for r in closed if r['next']), key=lambda r: (r['next'][0], r['next'][1], r['km']), default=None)
    return dict(query=query, categories=categories, time=when.strftime('%H:%M'), day=DAYS[when.weekday()], kind=kind,
                example=found[0] if found else None,
                open=[card(r) for r in open_rows[:3]], closed=[card(r) for r in closed[:4]],
                unknown=[card(r) for r in unknown[:2]], soonest=card(soonest) if soonest else None,
                near_count=sum(1 for r in rows if r['km'] <= NEAR_KM), hub=hub)


def nearby_hub(rows, lat, lon):
    """The closest area (about 1 km square) where several shops of this kind cluster, if it is within reach."""
    cells = collections.defaultdict(list)
    for r in rows:
        cells[(round(r['shop'].lat / .009), round(r['shop'].lon / .011))].append(r)
    best = None
    for members in cells.values():
        if len(members) < 4:
            continue
        c_lat = sum(r['shop'].lat for r in members) / len(members)
        c_lon = sum(r['shop'].lon for r in members) / len(members)
        km = distance(lat, lon, c_lat, c_lon)
        if km > HUB_KM:
            continue
        score = len(members) / (1 + km)
        if not best or score > best[0]:
            area = collections.Counter(r['shop'].area for r in members).most_common(1)[0][0]
            best = (score, dict(name=area, lat=round(c_lat, 5), lon=round(c_lon, 5), distance_km=km, shops=len(members),
                                open=sum(1 for r in members if r['open']), unknown=sum(1 for r in members if r['open'] is None)))
    return best[1] if best else None
