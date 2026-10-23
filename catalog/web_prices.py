"""Today's price on the open web: one web search, up to three shops, each tied to a page the search actually saw.

Nothing here becomes a recorded price; the page shows it as an unverified web result with its link."""
from urllib.parse import urlsplit

from . import ai
from .domain import usable_price

SYSTEM = ('Search the web for the current price of exactly this product in Iranian online shops (shop pages or Torob). '
          'Reply only JSON {"offers":[{"source":"shop name","url":"exact page url","price_toman":123}]} with the first 3 '
          'different shops whose page shows this exact model and variant in stock with a price. Convert rial to toman. '
          'Skip used items, other models, other storage or colour variants, and pages without a price. Empty list if none.')


def host(url):
    parts = urlsplit(url)
    return parts.hostname.removeprefix('www.') if parts.scheme in ('http', 'https') and parts.hostname else None


def clean(answer, seen, recorded=None):
    # The page must be one the search saw (by host), the price must be plausible, and each shop counts once.
    # Far from the recorded price usually means another model or a part, so those are dropped.
    seen_hosts = {host(u) for u in seen} - {None}
    offers, shops = [], set()
    for o in answer.get('offers') or [] if isinstance(answer, dict) else []:
        if not isinstance(o, dict) or not isinstance(o.get('url'), str) or not isinstance(o.get('source'), str):
            continue
        site, price, source = host(o['url']), usable_price(o.get('price_toman')), o['source'].strip()[:60]
        if not site or price is None or not source or source in shops or (seen_hosts and site not in seen_hosts) \
                or (recorded and not recorded / 4 <= price <= recorded * 4):
            continue
        shops.add(source)
        offers.append(dict(source=source, url=o['url'][:500], host=site, price=price))
    return offers[:3]


def lookup(product):
    query = ' '.join(filter(None, [product.title, product.brand and product.brand not in product.title and product.brand]))
    try:
        found = ai.web_search_json(SYSTEM, query)
    except ai.Unavailable:
        return dict(offers=[], available=False)
    return dict(offers=clean(found['answer'], found['seen'], usable_price(product.low)), available=True, checked_at=found['at'])
