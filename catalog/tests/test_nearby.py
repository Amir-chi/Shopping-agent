from django.core.cache import cache
from django.test import TestCase

from catalog.models import Shop
from .fixtures import seed


class NearbyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        Shop.objects.filter(pk='shop_two').update(lat=35.705, lon=51.4)  # about 560 m north
        Shop.objects.filter(pk='shop_empty').update(lat=35.75, lon=51.4)  # about 5.5 km away

    def setUp(self):
        cache.clear()

    def test_shops_with_saved_items_come_first(self):
        data = self.client.get('/api/nearby', {'lat': 35.705, 'lon': 51.4, 'ids': 'product_phone,product_shoes,bad id'}).json()
        self.assertEqual(data['total'], 2, 'only shops within walking distance')
        two, one = data['items']
        self.assertEqual((two['id'], two['distance_km'], [c['id'] for c in two['carries']]), ('shop_two', 0.0, ['product_phone']))
        self.assertEqual([c['id'] for c in one['carries']], ['product_shoes', 'product_phone'], 'cheapest first')
        self.assertEqual(self.client.get('/api/nearby', {'lat': 35.705, 'lon': 51.4}).json()['items'][0]['carries'], [])
        self.assertEqual(self.client.get('/api/nearby').status_code, 400)
