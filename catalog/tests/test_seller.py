import json
import os
from io import StringIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase

from catalog.models import Inquiry, Offer, OfferState, SellerAccess, SellerSession
from catalog.seller import issue_code
from .fixtures import seed


class SellerPanelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        cache.clear()

    def post(self, path, body, token=None):
        headers = {'HTTP_AUTHORIZATION': 'Bearer ' + token} if token else {}
        return self.client.post(path, json.dumps(body), content_type='application/json', **headers)

    def get(self, path, token, **params):
        return self.client.get(path, params, HTTP_AUTHORIZATION='Bearer ' + token)

    def login(self, shop_id='shop_one'):
        return self.post('/api/seller/login', dict(shop_id=shop_id, code=issue_code(shop_id))).json()

    def test_code_login_stores_only_hashes_and_a_new_code_signs_out(self):
        code = issue_code('shop_one')
        self.assertNotIn(code, SellerAccess.objects.get().code_hash)
        self.assertEqual(self.post('/api/seller/login', dict(shop_id='shop_one', code='wrong-code')).status_code, 401)
        data = self.post('/api/seller/login', dict(shop_id='shop_one', code=code.upper()[:5] + '-' + code.upper()[5:])).json()
        self.assertEqual((data['shop']['id'], data['demo']), ('shop_one', False), 'codes ignore case and dashes')
        self.assertNotIn(data['token'], SellerSession.objects.get().token_hash)
        self.assertEqual(self.get('/api/seller/shop_one/overview', data['token']).status_code, 200)
        issue_code('shop_one')
        self.assertEqual(self.get('/api/seller/shop_one/overview', data['token']).status_code, 401, 'a new code ends old sessions')
        out = StringIO()
        call_command('seller_code', 'shop_two', stdout=out)
        self.assertTrue(out.getvalue().startswith('shop_two\t'))

    def test_every_panel_call_needs_a_session_for_that_shop(self):
        token = self.login()['token']
        for path in ['/api/seller/shop_one/overview', '/api/seller/shop_one/conversations', '/api/seller/shop_one/products']:
            self.assertEqual(self.client.get(path).status_code, 401, path)
        self.assertEqual(self.get('/api/seller/shop_two/overview', token).status_code, 401, 'a session works only for its own shop')
        self.assertEqual(self.get('/api/seller/shop_one/unknown', token).status_code, 404)
        self.assertEqual(self.client.get('/api/seller/shop_one').status_code, 404, 'no public seller data')
        self.post('/api/seller/logout', {}, token)
        self.assertEqual(self.get('/api/seller/shop_one/overview', token).status_code, 401)

    def test_demo_login_reads_and_answers_but_cannot_change_prices(self):
        with patch.dict(os.environ, {'SELLER_DEMO': 'false'}):
            self.assertEqual(self.post('/api/seller/login', dict(shop_id='shop_one', demo=True)).status_code, 401)
            self.assertFalse(self.client.get('/api/seller/config').json()['demo'])
        with patch.dict(os.environ, {'SELLER_DEMO': 'true'}):
            demo = self.post('/api/seller/login', dict(shop_id='shop_one', demo=True)).json()
            shops = self.client.get('/api/seller/config').json()['shops']
        self.assertEqual([(s['id'], s['products'], s['trade']) for s in shops], [('shop_one', 5, 'مد و پوشاک')], 'one well-stocked sample shop per department')
        self.assertTrue(demo['demo'])
        self.assertEqual(self.get('/api/seller/shop_one/products', demo['token']).json()['total'], 5)
        self.assertEqual(self.post('/api/seller/shop_one/price', dict(offer_id='offer_phone', availability='in_stock', price='900000'), demo['token']).status_code, 403)
        self.assertFalse(OfferState.objects.exists())

    def test_inbox_thread_marks_read_and_shows_the_shop_price(self):
        self.post('/api/inquiries/new', dict(product_id='product_phone', shop_ids=['shop_one'], questions=['stock']))
        token = self.login()['token']
        overview = self.get('/api/seller/shop_one/overview', token).json()
        self.assertEqual((overview['stats']['unread'], overview['stats']['products'], len(overview['latest'])), (1, 5, 1))
        inbox = self.get('/api/seller/shop_one/conversations', token, status='unread').json()['items']
        thread = self.get('/api/seller/shop_one/thread', token, id=inbox[0]['id']).json()
        self.assertEqual((thread['your_price'], thread['seller_unread']), (1_000_000, False))
        self.assertEqual(self.get('/api/seller/shop_one/conversations', token, status='unread').json()['items'], [])
        self.assertEqual(self.get('/api/seller/shop_one/conversations', token, status='weird').status_code, 400)
        two = self.login('shop_two')['token']
        self.assertEqual(self.get('/api/seller/shop_two/thread', two, id=inbox[0]['id']).status_code, 404, 'another shop cannot open it')

    def test_products_search_facets_and_a_real_price_update(self):
        token = self.login()['token']
        page = self.get('/api/seller/shop_one/products', token, q='گوشی').json()
        self.assertEqual([i['offer_id'] for i in page['items']], ['offer_phone'])
        self.assertTrue(any(c['name'] == 'گوشی موبایل' for c in page['categories']))
        out = self.post('/api/seller/shop_one/price', dict(offer_id='offer_phone', availability='in_stock', price='۹۵۰ هزار'), token)
        self.assertEqual(out.json()['applied'], 1)
        state = OfferState.objects.get(offer_id='offer_phone')
        self.assertEqual((state.price_toman, state.availability, state.source), (950_000, 'in_stock', 'merchant_feed'))
        item = self.get('/api/seller/shop_one/products', token, q='گوشی').json()['items'][0]
        self.assertEqual((item['reported_price'], item['fresh']), (950_000, True))
        self.assertEqual(self.post('/api/seller/shop_one/price', dict(offer_id='offer_credit', availability='in_stock'), token).status_code, 404,
                         'a shop updates only its own offers')
        self.assertEqual(self.post('/api/seller/shop_one/price', dict(offer_id='offer_phone', availability='maybe'), token).status_code, 400)
        self.assertEqual(Offer.objects.get(pk='offer_credit').price, 2_000_000)
        self.assertEqual(Inquiry.objects.count(), 0)
