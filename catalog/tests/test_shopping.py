import json
import secrets
import threading
from datetime import timedelta
from django.test import TestCase, TransactionTestCase, override_settings
from django.db import close_old_connections, connection
from django.utils import timezone
from catalog import prices, services
from catalog.models import Offer, OfferState, PriceEvent, Product
from .fixtures import seed


def observation(**changes):
    return dict(offer_id='offer_phone', price_toman=1_500_000, availability='in_stock',
                observed_at=(timezone.now() - timedelta(seconds=60)).isoformat()) | changes


class ShoppingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def test_outfits_exact_prices_budget_seed_and_swap(self):
        data = services.outfits({'budget': '1000000', 'shoes': '1'})
        self.assertTrue(data['items'])
        for outfit in data['items']:
            self.assertEqual(outfit['shop_count'], 1)
            self.assertEqual(outfit['total'], sum(i['price'] for i in outfit['items']))
            self.assertLessEqual(outfit['total'], 1_000_000)
            for item in outfit['items']:
                offer = Offer.objects.get(pk=item['offer_id'])
                self.assertEqual(item['price'], offer.price)
                self.assertEqual(item['shop_id'], offer.shop_id)
        self.assertTrue(services.outfits({'seed': 'product_top'})['items'])
        self.assertFalse(services.outfits({'budget': '1000'})['items'])
        self.assertFalse(services.outfits({'fixed': 'product_top', 'exclude': 'product_bottom'})['items'])
        for args in [{'audience': 'other'}, {'budget': '-1'}, {'seed': 'product_phone'}]:
            with self.assertRaises(ValueError):
                services.outfits(args)

    def test_market_fallback_sources_and_empty_result(self):
        data = services.market_fallback({'q': 'کفش', 'lat': '35.7', 'lon': '51.4'})
        self.assertTrue(data['items'])
        self.assertIn('تأیید نشده', data['reason'])
        self.assertTrue(any(i['source'] == 'curated_guide' and i['source_url'] for i in data['items']))
        self.assertFalse(services.market_fallback({'q': 'zzzzunknown'})['items'])
        self.assertFalse(any(i['source'] == 'curated_guide' for i in services.market_fallback({'q': 'کفش', 'installment': '1'})['items']))

    def test_observation_idempotency_order_aggregates_and_raw(self):
        raw = Offer.objects.get(pk='offer_phone').raw.copy()
        row = observation()
        self.assertEqual(prices.ingest('shop_one', {'offers': [row]})['applied'], 1)
        self.assertEqual(prices.ingest('shop_one', {'offers': [row]})['duplicate'], 1)
        older = observation(price_toman=900000, observed_at=(timezone.now() - timedelta(hours=1)).isoformat())
        self.assertEqual(prices.ingest('shop_one', {'offers': [older]})['ignored_older'], 1)
        offer = Offer.objects.get(pk='offer_phone')
        self.assertEqual(offer.price, 1500000)
        self.assertEqual(offer.raw, raw)
        self.assertEqual(Product.objects.get(pk='product_phone').low, 1500000)
        prices.ingest('shop_one', {'offers': [observation(availability='out_of_stock', observed_at=timezone.now().isoformat())]})
        self.assertIsNone(Offer.objects.get(pk='offer_phone').price)
        self.assertEqual(Product.objects.get(pk='product_phone').low, 2000000)
        history = self.client.get('/api/offers/offer_phone/history').json()
        self.assertEqual(history['snapshot_price'], '1000000')
        self.assertEqual(len(history['events']), 3)

    def test_batch_validation_is_atomic_and_shop_scoped(self):
        with self.assertRaises(ValueError):
            prices.ingest('shop_one', {'offers': [observation(), observation(offer_id='offer_credit')]})
        self.assertEqual(PriceEvent.objects.count(), 0)
        self.assertEqual(OfferState.objects.count(), 0)
        for changes in [dict(price_toman=True), dict(price_toman=1.5), dict(price_toman=-1),
                        dict(availability='maybe'), dict(product_url='javascript:bad'), dict(observed_at='2026-01-01')]:
            with self.assertRaises(ValueError):
                prices.ingest('shop_one', {'offers': [observation(**changes)]})

    def test_expired_is_not_fresh(self):
        prices.ingest('shop_one', {'offers': [observation(observed_at=(timezone.now() - timedelta(days=1)).isoformat())]})
        item = next(s for s in services.product_stores('product_phone', {})['items'] if s['id'] == 'shop_one')
        self.assertFalse(item['price_fresh'])

    def test_http_auth_contract_and_disabled_connection(self):
        endpoint = '/api/merchant-feed/shop_one'
        self.assertEqual(self.client.post(endpoint, '{}', content_type='application/json').status_code, 503)
        token = secrets.token_urlsafe(32)
        with override_settings(MERCHANT_FEED_KEYS={'shop_one': token}):
            self.assertEqual(self.client.post(endpoint, '{}', content_type='application/json').status_code, 401)
            headers = {'HTTP_AUTHORIZATION': 'Bearer ' + token}
            self.assertEqual(self.client.post(endpoint, '{}', content_type='text/plain', **headers).status_code, 415)
            result = self.client.post(endpoint, json.dumps({'offers': [observation()]}), content_type='application/json', **headers)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['applied'], 1)
            self.assertEqual(self.client.get('/api/price-status').json()['connected_shops'], 1)


class ConcurrentFeedTests(TransactionTestCase):
    def test_two_shops_update_same_product_without_lost_aggregate(self):
        seed()
        barrier = threading.Barrier(2)
        errors = []

        def update(shop, offer, price):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                prices.ingest(shop, {'offers': [observation(offer_id=offer, price_toman=price)]})
            except Exception as error:
                errors.append(type(error).__name__)
            finally:
                connection.close()  # each thread has its own connection; leaving it open blocks dropping the test DB

        threads = [threading.Thread(target=update, args=('shop_one', 'offer_phone', 1600000)),
                   threading.Thread(target=update, args=('shop_two', 'offer_credit', 1700000))]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])
        p = Product.objects.get(pk='product_phone')
        self.assertEqual((p.low, p.high), (1600000, 1700000))
