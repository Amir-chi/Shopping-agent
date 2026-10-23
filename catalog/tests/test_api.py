from datetime import datetime
from unittest.mock import patch
from django.db import OperationalError
from django.test import TestCase
from catalog.domain import TEHRAN, constraints, distance, normalize, opening, origin_from, usable_price
from catalog.models import Metadata, Product
from .fixtures import seed


class CatalogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def test_bootstrap_and_health(self):
        boot = self.client.get('/api/bootstrap').json()
        self.assertEqual(boot['counts'], {'products': 5, 'shops': 3, 'offers': 6})
        self.assertEqual(boot['areas'][0]['name'], 'تهران')
        self.assertTrue(boot['data_notice']['phones_synthetic'])
        health = self.client.get('/api/health').json()
        self.assertEqual(health['database'], 'postgresql')
        self.assertTrue(health['catalog_ready'])

    def test_readiness_reports_missing_import_and_database_failure(self):
        Metadata.objects.filter(pk='import_complete').delete()
        self.assertEqual(self.client.get('/api/health').status_code, 503)
        with patch('catalog.views.connection.cursor', side_effect=OperationalError('private internal error')):
            response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(b'private internal error', response.content)

    def test_persian_alias_search_and_price(self):
        for query in ['گلکسی A55', 'galaxy A55', 'گوشی تا ۳۰ میلیون']:
            result = self.client.get('/api/products', {'q': query}).json()
            self.assertTrue(result['items'], query)
            self.assertEqual(result['items'][0]['id'], 'product_phone')
        self.assertEqual(normalize('ميكروفون ۱۲٣'), 'میکروفون 123')
        self.assertEqual(constraints('میکروفون')[0], 'میکروفون')

    def test_category_and_same_offer_credit_constraints(self):
        result = self.client.get('/api/products', {'q': 'لپ‌تاپ دانشجویی'}).json()
        self.assertEqual(result['items'][0]['id'], 'product_laptop')
        # Cheap non-credit offer must not qualify an expensive credit offer.
        result = self.client.get('/api/products', {'q': 'گوشی', 'installment': '1', 'max_price': '1500000'}).json()
        self.assertEqual(result['total'], 0)
        result = self.client.get('/api/products', {'q': 'گوشی', 'installment': '1', 'max_price': '2000000'}).json()
        self.assertEqual(result['total'], 1)

    def test_stable_pagination_and_invalid_input(self):
        first = self.client.get('/api/products', {'limit': 2}).json()
        second = self.client.get('/api/products', {'limit': 2, 'offset': 2}).json()
        self.assertFalse({i['id'] for i in first['items']} & {i['id'] for i in second['items']})
        for args in [{'limit': 'oops'}, {'max_price': '-1'}, {'q': 'x' * 201}]:
            self.assertEqual(self.client.get('/api/products', args).status_code, 400)

    def test_product_shop_relationship_and_source_labels(self):
        result = self.client.get('/api/products/product_phone/stores', {'lat': 35.7, 'lon': 51.4}).json()
        self.assertEqual(result['total'], 2)
        for shop in result['items']:
            self.assertTrue(shop['contacts_synthetic'])
            self.assertTrue(shop['name_synthetic'])
            self.assertEqual(shop['distance_km'], 0)
            self.assertTrue(all(o['product_id'] == 'product_phone' and o['shop_id'] == shop['id'] for o in shop['offers']))
        self.assertEqual(self.client.get('/api/shops/shop_empty/products').json()['total'], 0)
        self.assertEqual(self.client.get('/api/shops').json()['total'], 3)
        self.assertEqual(self.client.get('/api/shops/shop_one', {'lat': 'nan', 'lon': 51}).status_code, 400)

    def test_static_whitelist_and_methods(self):
        for path in ['/', '/ui.css', '/catalog.js', '/shopping.js', '/reviews.js', '/assets/favicon.svg', '/favicon.ico', '/assets/vazirmatn.woff2', '/admin/login/']:
            self.assertEqual(self.client.get(path).status_code, 200, path)
        for path in ['/data/catalog.sqlite3', '/server.py', '/.env', '/catalog/models.py', '/assets/../.env', '/api/products/product_missing']:
            self.assertEqual(self.client.get(path).status_code, 404, path)
        response = self.client.get('/api/bootstrap')
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(self.client.post('/api/products', {}).status_code, 405)
        self.assertIn('javascript', self.client.get('/sw.js')['Content-Type'])
        self.assertEqual([self.client.get(p)['Cache-Control'] for p in ('/', '/sw.js', '/ui.css', '/ui.css?v=1', '/sw.js?v=1')],
                         ['no-cache', 'no-cache', 'no-cache', 'public, max-age=31536000, immutable', 'no-cache'], 'the page is always revalidated')
        self.assertEqual(self.client.get('/manifest.webmanifest')['Content-Type'], 'application/manifest+json')

    def test_cached_catalog_aggregates_follow_data_changes(self):
        from catalog.models import Offer
        before = {s['id']: s['product_count'] for s in self.client.get('/api/shops').json()['items']}
        offer = Offer.objects.get(pk='offer_laptop')
        Offer.objects.create(id='offer_moved', product_id='product_laptop', shop_id='shop_empty', price=offer.price, changed=offer.changed, raw=offer.raw)
        after = {s['id']: s['product_count'] for s in self.client.get('/api/shops').json()['items']}
        self.assertEqual((before['shop_empty'], after['shop_empty']), (0, 1), 'a new offer is not hidden behind the cached counts')
        self.assertEqual(self.client.get('/api/bootstrap').json()['counts']['offers'], Offer.objects.count())

    def test_hours_and_validation(self):
        hours = {'sun': {'status': 'declared', 'shifts': [{'start_time': '22:00:00', 'end_time': '02:00:00'}]}, 'mon': {'status': 'closed'}}
        self.assertTrue(opening(hours, datetime(2026, 10, 19, 1, tzinfo=TEHRAN))['open'])
        self.assertFalse(opening(hours, datetime(2026, 10, 19, 12, tzinfo=TEHRAN))['open'])
        self.assertEqual(distance(35.7, 51.4, 35.7, 51.4), 0)
        for value in ['null', None, '-1', '0', '733518940747298944']:
            self.assertIsNone(usable_price(value))
        with self.assertRaises(ValueError):
            origin_from({'lat': 'nan', 'lon': 51})

    def test_read_only_admin_and_authentication(self):
        from django.contrib.auth import get_user_model
        user = get_user_model().objects.create_superuser('admin', password='test-only-not-a-real-credential')
        self.client.force_login(user)
        self.assertEqual(self.client.get('/admin/catalog/product/').status_code, 200)
        self.assertEqual(self.client.get('/admin/catalog/product/add/').status_code, 403)
        before = Product.objects.get(pk='product_phone').title
        response = self.client.post('/admin/catalog/product/product_phone/change/', {'title': 'changed'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Product.objects.get(pk='product_phone').title, before)
