import hmac
import json
import logging
import mimetypes

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import RequestDataTooBig
from django.db import DatabaseError, connection
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from . import decor, inquiries, photo, prices, services
from .models import Metadata

logger = logging.getLogger(__name__)
mimetypes.add_type('application/manifest+json', '.webmanifest')


def response(payload, status=200):
    result = JsonResponse(payload, status=status, json_dumps_params={'ensure_ascii': False, 'allow_nan': False})
    result['Cache-Control'] = 'no-store'
    return result


def client_address(request):
    # Behind the trusted proxy (DJANGO_TRUST_PROXY), Caddy replaces X-Forwarded-For with the real client address.
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '') if settings.SECURE_PROXY_SSL_HEADER else ''
    return forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')


def over_budget(request, prefix, limit):
    # Paid model calls: a simple per-address budget keeps one client from draining the key.
    key = prefix + client_address(request)
    if cache.get_or_set(key, 0, 600) >= limit:
        return True
    cache.incr(key)
    return False


@require_GET
def api(request, resource):
    if len(request.GET.urlencode()) > 8000 or len(request.GET.get('q', '')) > 200:
        return response({'error': 'Query too long'}, 400)
    if resource in ('assistant', 'compare-insight', 'video-reviews', 'gift', 'explain-specs') or (resource == 'outfits' and request.GET.get('review') == '1'):
        is_outfit = resource == 'outfits'
        prefix = 'video-rate:' if resource == 'video-reviews' else 'outfit-ai-rate:' if is_outfit else 'ai-rate:'
        if over_budget(request, prefix, 8 if is_outfit else 40):
            return response({'error': 'Too many assistant requests; try again in a few minutes'}, 429)
    # «همین الان» reads each new request with the router model once (then cached); switching the time re-asks freely.
    if resource == 'now' and over_budget(request, 'now-rate:', 120):
        return response({'error': 'Too many requests; try again in a few minutes'}, 429)
    if resource.endswith('/web-prices') and over_budget(request, 'web-price-rate:', 10):
        return response({'error': 'Too many price searches; try again in a few minutes'}, 429)
    try:
        return response(services.endpoint('/api/' + resource, request.GET.dict()))
    except (ValueError, KeyError, TypeError):
        return response({'error': 'Invalid request parameters'}, 400)
    except LookupError:
        return response({'error': 'Not found'}, 404)
    except DatabaseError:
        logger.error('Catalog database request failed')
        return response({'error': 'Catalog temporarily unavailable'}, 503)


@require_GET
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        ready = Metadata.objects.filter(pk='import_complete').exists()
        return response(dict(status='ok' if ready else 'catalog_not_imported', backend='django', database='postgresql', catalog_ready=ready), 200 if ready else 503)
    except DatabaseError:
        return response(dict(status='database_unavailable', backend='django', database='postgresql'), 503)


@csrf_exempt
@require_POST
def merchant_feed(request, shop_id):
    # Bearer authentication only; no session-authenticated writes on this endpoint.
    key = settings.MERCHANT_FEED_KEYS.get(shop_id)
    if not isinstance(key, str) or len(key) < 32:
        return response({'error': 'Merchant connection is not configured'}, 503)
    supplied = request.headers.get('Authorization', '')
    if not hmac.compare_digest(supplied.encode(), ('Bearer ' + key).encode()):
        return response({'error': 'Unauthorized'}, 401)
    if request.content_type != 'application/json':
        return response({'error': 'Use application/json'}, 415)
    try:
        if int(request.headers.get('Content-Length', '0')) > 1_048_576:
            raise RequestDataTooBig()
        payload = json.loads(request.body)
        return response(prices.ingest(shop_id, payload))
    except RequestDataTooBig:
        return response({'error': 'Payload too large'}, 413)
    except (ValueError, TypeError, KeyError):
        return response({'error': 'Invalid merchant observation'}, 400)
    except DatabaseError:
        return response({'error': 'Price update temporarily unavailable'}, 503)


def json_post(request, prefix, limit, handle):
    # No session or account behind these endpoints, so CSRF protects nothing; photos are never stored or logged.
    if request.content_type != 'application/json':
        return response({'error': 'Use application/json'}, 415)
    if over_budget(request, prefix, limit):
        return response({'error': 'Too many requests; try again in a few minutes'}, 429)
    try:
        if int(request.headers.get('Content-Length', '0')) > 1_048_576:
            raise RequestDataTooBig()
        return response(handle(json.loads(request.body)))
    except RequestDataTooBig:
        return response({'error': 'Request too large'}, 413)
    except (ValueError, TypeError, KeyError):
        return response({'error': 'Invalid request'}, 400)
    except LookupError:
        return response({'error': 'Not found'}, 404)
    except DatabaseError:
        return response({'error': 'Catalog temporarily unavailable'}, 503)


@csrf_exempt
@require_POST
def color_advice(request):
    return json_post(request, 'decor-rate:', 8, decor.advise)


@csrf_exempt
@require_POST
def photo_search(request):
    return json_post(request, 'photo-rate:', 8, photo.search)


@csrf_exempt
@require_POST
def new_inquiry(request):
    return json_post(request, 'inquiry-rate:', 20, inquiries.create)


def not_found(request):
    # Seller data is never served through the public GET router; only the authenticated panel views answer under /api/seller/.
    return response({'error': 'Not found'}, 404)


def send_file(path, cache_control='no-cache'):
    if not path.is_file():
        raise Http404()
    result = FileResponse(path.open('rb'), content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
    result['Cache-Control'] = cache_control
    return result


@require_GET
def index(request):
    return send_file(settings.BASE_DIR / 'index.html')


@require_GET
def frontend_asset(request, asset):
    # URL patterns are an explicit whitelist; no source, database, env or directory access.
    # index.html and sw.js are always revalidated; scripts and styles carrying a ?v= version never change under that URL.
    versioned = 'v' in request.GET and asset not in ('sw.js', 'manifest.webmanifest')
    return send_file(settings.BASE_DIR / asset, 'public, max-age=31536000, immutable' if versioned else 'no-cache')


@require_GET
def asset(request, asset):
    return send_file(settings.BASE_DIR / 'assets' / asset, 'public, max-age=604800')
