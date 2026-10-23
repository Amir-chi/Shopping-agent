"""HTTP layer for the seller panel and buyer follow-ups. Panel calls carry `Authorization: Bearer <session token>`;
no cookies are involved, so CSRF does not apply."""
import json

from django.core.exceptions import RequestDataTooBig
from django.db import DatabaseError
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from . import inquiries, seller
from .views import over_budget, response

READ = {'overview': seller.overview, 'conversations': seller.conversations, 'thread': seller.thread, 'products': seller.products}
WRITE = {'reply': seller.reply, 'price': seller.update_price}


def _handle(call):
    try:
        return response(call())
    except seller.Unauthorized as error:
        return response({'error': str(error)}, 401)
    except seller.DemoForbidden:
        return response({'error': 'demo'}, 403)
    except RequestDataTooBig:
        return response({'error': 'Request too large'}, 413)
    except (ValueError, TypeError, KeyError):
        return response({'error': 'Invalid request'}, 400)
    except LookupError:
        return response({'error': 'Not found'}, 404)
    except DatabaseError:
        return response({'error': 'Temporarily unavailable'}, 503)


def _json(request):
    if request.content_type != 'application/json':
        raise ValueError('Use application/json')
    if int(request.headers.get('Content-Length', '0')) > 32_768:
        raise RequestDataTooBig()
    return json.loads(request.body)


@require_GET
def config(request):
    demo = seller.demo_enabled()
    return response(dict(demo=demo, shops=seller.demo_shops() if demo else []))


@csrf_exempt
@require_POST
def login(request):
    # Few attempts per address: access codes are long, and this keeps guessing slow anyway.
    if over_budget(request, 'seller-login:', 12):
        return response({'error': 'Too many attempts; try again in a few minutes'}, 429)
    return _handle(lambda: seller.login(_json(request)))


@csrf_exempt
@require_POST
def logout(request):
    return _handle(lambda: seller.logout(request.headers.get('Authorization', '')))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def panel(request, shop_id, section):
    table = READ if request.method == 'GET' else WRITE
    if section not in table:
        return response({'error': 'Not found'}, 404)
    if request.method == 'POST' and over_budget(request, 'seller-write:', 120):
        return response({'error': 'Too many requests; try again in a few minutes'}, 429)

    def call():
        s = seller.session(request.headers.get('Authorization', ''), shop_id)
        return table[section](s, request.GET.dict() if request.method == 'GET' else _json(request))
    return _handle(call)


@csrf_exempt
@require_POST
def buyer_reply(request):
    if over_budget(request, 'buyer-reply:', 30):
        return response({'error': 'Too many messages; try again in a few minutes'}, 429)
    return _handle(lambda: inquiries.buyer_reply(_json(request)))
