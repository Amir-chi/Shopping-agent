"""Pure catalog rules: no HTTP, ORM or database dependencies."""
import itertools
import math
import re
from datetime import datetime, timedelta, timezone

TEHRAN = timezone(timedelta(hours=3, minutes=30))
DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩يك', '01234567890123456789یک')
import json

def normalize(value):
    value = str(value or '').translate(DIGITS).lower().replace('\u200c', ' ')
    value = re.sub(r'([a-z])\s+(\d)', r'\1\2', value)
    return ' '.join(re.findall(r'[^\W_]+', value, re.UNICODE))


def parsed(value, fallback=None):
    if value in ('', 'null', None):
        return fallback
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return fallback


def usable_price(value):
    try:
        price = int(value)
        # Retain outliers in raw records; exclude only from price comparisons.
        return price if 1000 <= price <= 10_000_000_000 else None
    except (ValueError, TypeError):
        return None


def parse_price(text):
    """Toman from shopper input such as «۲۶٫۵ میلیون» or «26,500,000»; None unless it is a usable price."""
    value = str(text or '').translate(DIGITS).replace('٫', '.').replace('/', '.')
    # Separators as the app itself prints them (٬) or as people type them (, ،).
    match = re.fullmatch(r'\s*(\d{1,3}(?:[,،٬]\d{3})+|\d+(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)?\s*(?:تومان|تومن)?\s*', value)
    if not match:
        return None
    number = float(re.sub('[,،٬]', '', match[1]))
    return usable_price(round(number * {'میلیارد': 1_000_000_000, 'میلیون': 1_000_000, 'هزار': 1000}.get(match[2], 1)))


def price_position(price, prices):
    """Where a quoted price sits among recorded per-shop prices: a comparison with stored data, not today's market."""
    prices = sorted(prices)
    cheaper = sum(p < price for p in prices)
    share = cheaper / len(prices)
    level = ('below' if price < prices[0] else 'above' if price > prices[-1] else
             'low' if share < 1 / 3 else 'high' if share > 2 / 3 else 'typical')
    return dict(level=level, cheaper_shops=cheaper, shops=len(prices), low=prices[0], median=prices[(len(prices) - 1) // 2], high=prices[-1])


def constraints(query):
    q = normalize(query)
    maximum = None
    m = re.search(r'(?:تا|بودجه|حدود)\s*(\d+(?:\s+\d{3})*)\s*(میلیون|هزار)?', q)
    if m:
        value = int(m[1].replace(' ', ''))
        maximum = value * (1_000_000 if m[2] == 'میلیون' else 1000 if m[2] == 'هزار' else 1)
        q = q[:m.start()] + ' ' + q[m.end():]
    installment = bool(re.search(r'قسط|اعتباری', q))
    category_hint = None
    # Accessories contain "phone" too: resolve the explicit product kind first.
    if re.search(r'شارژر|charger', q) and not re.search(r'پاوربانک', q):
        category_hint = 'شارژر گوشی'
        q = re.sub(r'\b(?:گوشی|موبایل|charger|شارژر)\b', '', q)
    elif re.search(r'قاب|کاور', q) and re.search(r'گوشی|موبایل|galaxy|iphone|آیفون', q):
        category_hint = 'کیف و کاور گوشی'
        q = re.sub(r'\b(?:قاب|کاور|گوشی|موبایل)\b', '', q)
    elif re.search(r'محافظ صفحه|گلس', q):
        category_hint = 'محافظ صفحه نمایش گوشی'
        q = re.sub(r'\b(?:محافظ|صفحه|نمایش|گوشی|گلس)\b', '', q)
    elif re.search(r'هدفون|هدست|هندزفری', q):
        category_hint = 'هدفون، هدست و هندزفری'
        q = re.sub(r'\b(?:هدفون|هدست|هندزفری|بی سیم|ارزان)\b', '', q)
    elif re.search(r'گوشی|موبایل|galaxy|iphone|آیفون', q):
        category_hint = 'گوشی موبایل'
    elif re.search(r'لپ\s*تاپ|لپتاپ|laptop', q):
        category_hint = 'لپ تاپ و نوت بوک'
        q = re.sub(r'لپ\s*تاپ|لپتاپ|laptop', ' ', q)
    elif re.search(r'کتانی|کتونی', q):
        category_hint = 'کتانی و کفش اسپرت'
    q = re.sub(r'\b(?:خرید قسطی|خرید اعتباری|قسطی|اعتباری|برای|مناسب|میخواهم|می خوام|میخوام|می خواهم|دانشجویی|پیاده روی|روزمره|بودجه ام|بودجه|تومان|میلیون|با دوربین خوب|دوربین خوب|عکاسی|خرید|با|یک)\b', ' ', q)
    q = normalize(q)
    # These are search aliases, not invented product attributes.
    q = q.replace('کتونی', 'کتانی')
    return q, maximum, installment, category_hint


def opening(hours, now=None):
    now = now or datetime.now(TEHRAN)
    keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    today = hours.get(keys[now.weekday()], {})
    def seconds(value):
        h, m, s = map(int, value.split(':'))
        return h * 3600 + m * 60 + s
    clock = now.hour * 3600 + now.minute * 60 + now.second
    valid_today = any(s.get('start_time') and s.get('end_time') and s['start_time'] != s['end_time'] for s in today.get('shifts', []))
    declared = today.get('status') == 'closed' or (today.get('status') == 'declared' and valid_today)
    for day, previous in ((today, False), (hours.get(keys[(now.weekday() - 1) % 7], {}), True)):
        if day.get('status') != 'declared':
            continue
        for shift in day.get('shifts', []):
            try:
                start, end = seconds(shift['start_time']), seconds(shift['end_time'])
                if start == end:
                    continue  # Ambiguous, not proof of 24-hour opening.
                active = (end < start and clock < end) if previous else (start <= clock < end if start < end else clock >= start)
                if active:
                    return dict(open=True, label='طبق برنامه باز تا ' + shift['end_time'][:5])
            except (ValueError, KeyError, TypeError):
                continue
    return dict(open=False if declared else None, label='طبق برنامه ثبت‌شده بسته است' if declared else 'ساعت امروز مشخص نیست')


def distance(lat, lon, other_lat, other_lon):
    a, b = math.radians(lat), math.radians(other_lat)
    delta = math.sin((b - a) / 2) ** 2 + math.cos(a) * math.cos(b) * math.sin(math.radians(other_lon - lon) / 2) ** 2
    return round(6371 * 2 * math.asin(min(1, math.sqrt(delta))), 2)


WEEKDAYS_FA = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه', 'یکشنبه']


def next_opening(hours, now=None):
    """When a closed shop next opens by its declared weekly hours: (days ahead, 'HH:MM', Persian label), or None."""
    now = now or datetime.now(TEHRAN)
    keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    clock = now.strftime('%H:%M:%S')
    for ahead in range(8):
        day = hours.get(keys[(now.weekday() + ahead) % 7], {})
        if day.get('status') != 'declared':
            continue
        starts = sorted(s['start_time'] for s in day.get('shifts', [])
                        if s.get('start_time') and s.get('end_time') and s['start_time'] != s['end_time'] and (ahead or s['start_time'] > clock))
        if starts:
            at = starts[0][:5]
            hour, minute = map(int, at.split(':'))
            minutes = int(((now + timedelta(days=ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0) - now).total_seconds() // 60)
            if minutes < 180:
                return ahead, at, f'{minutes} دقیقهٔ دیگر' if minutes < 60 else f'{minutes // 60} ساعت و {minutes % 60} دقیقهٔ دیگر'
            when = 'امروز' if ahead == 0 else 'فردا' if ahead == 1 else WEEKDAYS_FA[(now.weekday() + ahead) % 7]
            return ahead, at, f'{when} ساعت {at}'
    return None


def visit_order(stops, coords, origin=None):
    """Shortest open path through the stops, from the origin when known: exact up to 7 stops, nearest neighbour beyond."""
    def length(seq):
        points = ([origin] if origin else []) + [coords[s] for s in seq]
        return sum(distance(*a, *b) for a, b in zip(points, points[1:]))
    stops = sorted(stops)
    if len(stops) <= 7:
        seq = min(itertools.permutations(stops), key=length) if stops else ()
    else:
        seq, left, here = [], set(stops), origin or coords[stops[0]]
        while left:
            nxt = min(sorted(left), key=lambda s: distance(*here, *coords[s]))
            seq.append(nxt)
            left.remove(nxt)
            here = coords[nxt]
    return list(seq), round(length(seq), 2)


def nearest_station(lat, lon, stations, within=2.0):
    """Closest metro station by straight-line distance, or None when it is farther than `within` km."""
    best = min(stations, key=lambda s: distance(lat, lon, s['lat'], s['lon']), default=None)
    km = distance(lat, lon, best['lat'], best['lon']) if best else None
    return dict(name=best['name'], distance_km=km) if best and km <= within else None


def split_budget(budget, medians):
    """Each category's share of the budget, in proportion to its median recorded price."""
    total = sum(medians.values())
    return {key: round(budget * median / total) for key, median in medians.items()} if total else {}


def tier_options(share, candidates, tiers=(('economy', .65), ('balanced', 1.0), ('better', 1.4))):
    """Up to three distinct products priced nearest to fractions of a category's share.

    candidates is [(product_id, price, stores)]; better-stocked listings win close calls."""
    picked, used = [], set()
    for tier, factor in tiers:
        target = share * factor
        options = [c for c in candidates if c[0] not in used]
        if not options:
            break
        pid, price, _ = min(options, key=lambda c: (abs(math.log(c[1] / target)) - min(c[2], 10) * .01, c[0]))
        used.add(pid)
        picked.append(dict(product=pid, price=price))
    # Labels follow price order, so a sparse category never shows a pricier "economy" pick.
    return [o | dict(tier=t[0]) for o, t in zip(sorted(picked, key=lambda o: o['price']), tiers)]


def similar_options(share, candidates, exclude, limit=6):
    """More listings priced near a category's share, cheapest first, beyond the three tier picks."""
    share = max(share, 1)
    near = sorted((c for c in candidates if c[0] not in exclude),
                  key=lambda c: (abs(math.log(c[1] / share)) - min(c[2], 10) * .01, c[0]))[:limit]
    return [dict(product=pid, price=price) for pid, price, _ in sorted(near, key=lambda c: (c[1], c[0]))]


def plan_route(prices, coords, origin=None, closed=frozenset(), limit=40):
    """Two shopping plans for a list of products: the fewest shops, and the cheapest per product.

    prices is {shop: {product: price}}. Shops declared closed now are used only for products nobody open carries.
    ponytail: exact search up to three shops over a capped candidate list, greedy beyond; straight-line legs, not streets."""
    wanted = sorted({p for offers in prices.values() for p in offers})
    allowed = {s for s in prices if s not in closed}
    allowed |= {s for p in wanted if not any(p in prices[o] for o in allowed) for s in prices if p in prices[s]}
    carriers = {p: sorted((s for s in allowed if p in prices[s]), key=lambda s: (prices[s][p], s)) for p in wanted}

    def assign(shops):
        return {p: min((s for s in shops if p in prices[s]), key=lambda s: (prices[s][p], s)) for p in wanted}

    def build(kind, picks):
        seq, km = visit_order(set(picks.values()), coords, origin)
        stops, here = [], origin
        for s in seq:
            stops.append(dict(shop=s, items=[(p, prices[s][p]) for p in wanted if picks[p] == s], closed=s in closed,
                              leg_km=distance(*here, *coords[s]) if here else None))
            here = coords[s]
        return dict(kind=kind, stops=stops, total=sum(prices[s][p] for p, s in picks.items()), shop_count=len(seq), distance_km=km)

    if not wanted:
        return []
    cheapest = build('cheapest', {p: carriers[p][0] for p in wanted})
    pool = {s for p in wanted for s in carriers[p][:6]}
    if origin:
        pool |= {s for p in wanted for s in sorted(carriers[p], key=lambda s: distance(*origin, *coords[s]))[:6]}
    pool |= set(sorted(allowed, key=lambda s: (-len(prices[s]), s))[:10])
    pool = sorted(pool, key=lambda s: (-len(set(prices[s]) & set(wanted)), sum(prices[s].values()), s))[:limit]
    fewest = None
    for k in range(1, 4):
        covers = [c for c in itertools.combinations(pool, k) if all(any(p in prices[s] for s in c) for p in wanted)]
        if covers:
            fewest = min((assign(c) for c in covers), key=lambda a: (sum(prices[s][p] for p, s in a.items()), visit_order(set(a.values()), coords, origin)[1]))
            break
    if fewest is None:
        chosen, left = [], set(wanted)
        while left:
            best = min(allowed, key=lambda s: (-len(left & set(prices[s])), sum(prices[s].get(p, 0) for p in left), s))
            chosen.append(best)
            left -= set(prices[best])
        fewest = assign(chosen)
    plans = [build('fewest', fewest)]
    if set(fewest.values()) != {s['shop'] for s in cheapest['stops']}:
        plans.append(cheapest)
    return plans



def origin_from(args):
    if 'lat' not in args and 'lon' not in args:
        return None
    lat, lon = float(args['lat']), float(args['lon'])
    if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError('Invalid coordinates')
    return lat, lon


# Category membership is explicit: children's wear and underwear are not outfit pieces.
# slot -> {leaf category: audience}; styling_eligible handles unknown/unisex explicitly.
GARMENTS = {
    'onepiece': {'سارافون زنانه': 'women', 'لباس مجلسی زنانه': 'women'},
    'top': {'پیراهن مردانه': 'men', 'تیشرت و پولوشرت': 'men', 'سویشرت و هودی مردانه': 'men', 'ژاکت و پلیور مردانه': 'men',
            'شومیز و تونیک زنانه': 'women', 'بلوز و پیراهن زنانه': 'women', 'تاپ و تیشرت زنانه': 'women',
            'نیم تنه و کراپ زنانه': 'women', 'ژاکت و پلیور زنانه': 'women', 'هودی و سویشرت': 'unknown'},
    'bottom': {'شلوار رسمی و راحتی مردانه': 'men', 'شلوارک مردانه': 'men', 'شلوار و لگ': 'women',
               'شلوار و سرهمی زنانه': 'women', 'دامن زنانه': 'women'},
    'outer': {'کت و جلیقه مردانه': 'men', 'کاپشن، بارانی و پالتو مردانه': 'men', 'مانتو، پانچ و رویه': 'women',
              'کت و جلیقه زنانه': 'women', 'کاپشن، بارانی و پالتو زنانه': 'women'},
    'shoes': {'کتانی و کفش اسپرت': 'unknown', 'کفش مجلسی و رسمی مردانه': 'men', 'کفش کالج مردانه': 'men',
              'بوت و نیم بوت مردانه': 'men', 'سایر کفش مردانه': 'men', 'کفش کالج زنانه': 'women',
              'کفش پاشنه بلند و مجلسی زنانه': 'women', 'سایر کفش زنانه': 'women', 'بوت و نیم بوت زنانه': 'women',
              'صندل مجلسی زنانه': 'women'},
    'accessory': {'ساعت مچی عقربه‌ ای و دیجیتالی': 'unknown', 'عینک آفتابی': 'unknown', 'کیف و کوله': 'unknown',
                  'کمربند': 'unknown', 'کیف کمری و بادی بگ': 'unknown', 'کراوات': 'men', 'شال': 'women'},
}
# Style signal per category; everything else is neutral for both styles.
FORMAL = {'پیراهن مردانه', 'بلوز و پیراهن زنانه', 'شومیز و تونیک زنانه', 'کت و جلیقه مردانه', 'کت و جلیقه زنانه',
          'کفش مجلسی و رسمی مردانه', 'کفش کالج مردانه', 'کفش کالج زنانه', 'کفش پاشنه بلند و مجلسی زنانه',
          'صندل مجلسی زنانه', 'کراوات', 'ساعت مچی عقربه‌ ای و دیجیتالی', 'کمربند', 'دامن زنانه'}
CASUAL = {'تیشرت و پولوشرت', 'تاپ و تیشرت زنانه', 'نیم تنه و کراپ زنانه', 'سویشرت و هودی مردانه', 'هودی و سویشرت',
          'شلوارک مردانه', 'شلوار و لگ', 'کتانی و کفش اسپرت', 'کیف کمری و بادی بگ', 'کیف و کوله', 'عینک آفتابی',
          'بوت و نیم بوت مردانه', 'بوت و نیم بوت زنانه'}
COLORS = {'مشکی': '#252525', 'سفید': '#f3f3ed', 'سرمه ای': '#25334f', 'خاکستری': '#8a8e90',
          'طوسی': '#8a8e90', 'کرم': '#daccad', 'بژ': '#c8b89e', 'آبی': '#507eaf', 'سبز': '#52785b',
          'قهوه ای': '#865f45', 'قرمز': '#ab4543', 'صورتی': '#d695a4', 'بنفش': '#80659d', 'زرد': '#d7b65b', 'نارنجی': '#cf874a'}
NEUTRALS = {'مشکی', 'سفید', 'سرمه ای', 'خاکستری', 'طوسی', 'کرم', 'بژ'}


def garment_profile(category):
    for slot, members in GARMENTS.items():
        if category in members:
            return slot, members[category]
    return None, None


def garment_attributes(raw):
    specs = parsed(raw.get('specs'), [])
    color_values = [str(s.get('value', '')) for s in specs if normalize(s.get('key')) in ('رنگ', 'color')]
    text = normalize(' '.join(color_values) if color_values else raw['persian_title'])
    colors = [c for c in COLORS if re.search(r'\b' + re.escape(c) + r'\b', text)]
    color = colors[0] if len(colors) == 1 else None
    title = normalize(raw['persian_title'])
    gender_text = title + ' ' + ' '.join(normalize(s.get('value')) for s in specs if 'جنسیت' in s.get('key', ''))
    audience = 'women' if 'زنانه' in gender_text and 'مردانه' not in gender_text else 'men' if 'مردانه' in gender_text and 'زنانه' not in gender_text else garment_profile(raw['category_name'])[1]
    pattern = any(t in title for t in ('طرح دار', 'گلدار', 'چهارخانه', 'راه راه'))
    return dict(color=color, color_hex=COLORS.get(color, '#dce5df'),
                color_options=colors, patterned=pattern, audience=audience,
                sizes=[str(s.get('value', '')) for s in specs if 'سایز' in s.get('key', '') or normalize(s.get('key')) == 'size'])


def outfit_score(items, style):
    """Conservative metadata compatibility, not an aesthetic/fit prediction."""
    attrs = [i['attributes'] for i in items]
    kinds = {a.get('kind') for a in attrs}
    if kinds & {'hoodie', 'jogger', 'leggings', 'shorts', 'sneakers'} and 'heels' in kinds:
        return 0, []
    if sum(a.get('patterned', False) for a in attrs) > 1:
        return 0, []
    colors = [a.get('color') for a in attrs if a.get('color')]
    accents = set(colors) - NEUTRALS
    families = [{'آبی', 'سبز'}, {'صورتی', 'بنفش', 'قرمز'}, {'قهوه ای', 'زرد', 'نارنجی'}]
    if len(accents) > 1 and not any(accents <= family for family in families):
        return 0, []
    missing = len(items) - len(colors)
    score = 50 + (20 if not missing else 5 if missing == 1 else -10)
    score += 10 if not accents and colors else 8 if len(accents) == 1 else 4
    score += 10 if all(a.get('kind') != 'unknown' for a in attrs) else -5
    reasons = ['نقش اجزا و ناسازگاری‌های مشخص پوشش بررسی شده‌اند؛ این امتیاز، تضمین زیبایی یا تن‌خور نیست.']
    if colors:
        reasons.append('ترکیب رنگ خنثی است.' if not accents else 'رنگ‌های شاخص محدود و در یک خانوادهٔ پیشنهادی‌اند.')
    if missing:
        reasons.append('رنگ برخی اجزا نامشخص یا چندگزینه‌ای است؛ پیش از خرید تأیید کن.')
    return min(100, score), reasons


def styling_profile(raw):
    """Recomputed from source: no migration or assumptions from stale Garment rows."""
    attrs = garment_attributes(raw)
    category, title = normalize(raw['category_name']), normalize(raw['persian_title'])
    title_colors = [c for c in COLORS if re.search(r'\b' + re.escape(c) + r'\b', title)]
    color_conflict = bool(attrs['color'] and title_colors and attrs['color'] not in title_colors)
    # Contradictory title/spec colors must not masquerade as a known neutral color.
    if color_conflict:
        attrs['color'], attrs['color_hex'] = None, '#dce5df'
    slot, _ = garment_profile(raw['category_name'])
    kinds = [
        ('onepiece', 'سرهمی|اورال|سارافون|ماکسی|پیراهن بلند|پیراهن مجلسی'),
        ('hoodie', 'هودی|سویشرت'), ('crop', 'کراپ|نیم تنه'),
        ('skirt', 'دامن'), ('shorts', 'شلوارک'), ('jogger', 'جاگر|اسلش'),
        ('leggings', 'لگ'), ('jeans', 'جین|لی'), ('trousers', 'شلوار'),
        ('heels', 'پاشنه بلند|صندل مجلسی'), ('sneakers', 'کتانی|کتونی|رانینگ|ونس'),
        ('loafers', 'کالج'), ('boots', 'بوت'), ('dress_shoes', 'کفش مجلسی|کفش رسمی'),
        ('outer', 'مانتو|پانچ|رویه|پالتو|بارانی|کاپشن|جلیقه|کت'),
        ('tshirt', 'تیشرت|تی شرت|پولوشرت|تاپ'), ('knit', 'ژاکت|پلیور|بافت'),
        ('blouse', 'شومیز|بلوز|بولیز'), ('shirt', 'پیراهن'),
    ]
    def has(pattern, value):
        return bool(re.search(r'\b(?:' + pattern + r')\b', value))
    # The title disambiguates mixed leaves such as "trousers and leggings".
    kind = next((kind for kind, pattern in kinds if has(pattern, title)), None)
    kind = kind or next((kind for kind, pattern in kinds if has(pattern, category)), 'unknown')
    if slot == 'accessory':
        kind = 'accessory'
    if slot == 'onepiece':
        kind = 'onepiece'
    if kind == 'onepiece':
        slot = 'onepiece'
    unsuitable = has('بچگانه|دخترانه|پسرانه|نوزادی|لباس خواب|پیژامه|لباس زیر|ست لباس|ست زنانه|ست مردانه', title)
    unisex = has('یونیسکس|یونی سکس|unisex', title) or ('زنانه' in title and 'مردانه' in title)
    warm = has('تابستانی|نخی|لینن|کتان نازک', title)
    cold = has('زمستانی|پشمی|کرکی|تو کرک|دورس|گرماژ بالا', title) or kind == 'knit' or 'پالتو' in title
    season = 'cold' if cold and not warm else 'warm' if warm and not cold else 'unknown'
    revealing = kind in ('crop', 'shorts') or has('مینی|کوتاه|حلقه ای|بدون آستین|دکلته', title)
    fit = ('relaxed' if has('بگ|لش|آزاد|اورسایز|باکسی|oversize|گشاد', title) else
           'fitted' if has('جذب|اسلیم|اندامی|fitted|skinny', title) else 'unknown')
    return attrs | dict(slot=slot, kind=kind, unsuitable=unsuitable, unisex=unisex,
                        season=season, revealing=revealing, color_conflict=color_conflict, fit=fit)


def styling_eligible(attrs, prefs):
    if not attrs['slot'] or attrs['unsuitable'] or attrs['color_conflict']:
        return False
    if attrs['audience'] != prefs['audience']:
        # Unknown gender is not automatically unisex; shoes/accessories remain explicitly uncertain.
        if attrs['audience'] != 'unknown' or not (attrs['unisex'] or attrs['slot'] in ('shoes', 'accessory')):
            return False
    kind = attrs['kind']
    if (prefs['style'] == 'formal' or prefs['occasion'] in ('work', 'party')) and kind in (
            'hoodie', 'crop', 'tshirt', 'jogger', 'leggings', 'shorts', 'sneakers', 'jeans', 'unknown'):
        return False
    if prefs['occasion'] == 'sport' and kind not in ('tshirt', 'hoodie', 'crop', 'jogger', 'leggings', 'shorts', 'sneakers', 'accessory'):
        return False
    if prefs['coverage'] == 'covered' and (attrs['revealing'] or kind == 'leggings'):
        return False
    if prefs['season'] != 'any' and attrs['season'] not in ('unknown', prefs['season']):
        return False
    if prefs['palette'] == 'neutral' and attrs['color'] not in NEUTRALS:
        return False
    liked = prefs.get('liked_colors', [])
    if liked and attrs['color'] not in set(liked) | NEUTRALS:
        return False
    if prefs.get('aesthetic') == 'minimal' and attrs['patterned']:
        return False
    if prefs.get('aesthetic') == 'street' and kind in ('heels', 'dress_shoes'):
        return False
    if attrs['slot'] in ('top', 'bottom', 'onepiece', 'outer'):
        fit = prefs.get('fit', 'any')
        if fit != 'any' and attrs['fit'] not in ('unknown', fit):
            return False
    return True



