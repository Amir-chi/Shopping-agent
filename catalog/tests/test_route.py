from django.test import TestCase

from catalog.domain import nearest_station, plan_route, visit_order
from catalog.models import Offer, Product, Shop
from .fixtures import seed

PRICES = {'A': {'phone': 100, 'case': 10}, 'B': {'phone': 90}, 'C': {'case': 5, 'buds': 20},
          'D': {'buds': 25, 'case': 12, 'phone': 120}, 'Z': {'buds': 1}}
COORDS = {'A': (35.70, 51.40), 'B': (35.71, 51.41), 'C': (35.72, 51.42), 'D': (35.75, 51.45), 'Z': (35.80, 51.50)}


class RoutePlanTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def test_fewest_shops_and_cheapest_plans(self):
        fewest, cheapest = plan_route(PRICES, COORDS, (35.70, 51.40), closed={'Z'})
        self.assertEqual((fewest['shop_count'], fewest['total'], [s['shop'] for s in fewest['stops']]), (1, 157, ['D']))
        self.assertEqual((cheapest['shop_count'], cheapest['total']), (2, 115), 'a shop closed now is skipped when others carry the item')
        self.assertEqual([s['shop'] for s in cheapest['stops']], ['B', 'C'], 'nearest stop first from the origin')
        self.assertGreater(cheapest['stops'][0]['leg_km'], 0)

    def test_closed_shop_is_kept_only_when_nobody_else_has_the_item(self):
        plans = plan_route({'Z': {'x': 5}, 'A': {'y': 3}}, {'Z': (35.7, 51.4), 'A': (35.71, 51.4)}, None, closed={'Z'})
        self.assertEqual(len(plans), 1, 'identical plans are not repeated')
        stops = {s['shop']: s for s in plans[0]['stops']}
        self.assertTrue(stops['Z']['closed'])
        self.assertIsNone(plans[0]['stops'][0]['leg_km'], 'no origin, no first leg')

    def test_large_lists_fall_back_to_greedy_and_nearest_neighbour(self):
        prices = {f's{i}': {f'p{i}': 10} for i in range(9)}
        coords = {f's{i}': (35.7 + i / 100, 51.4) for i in range(9)}
        fewest = plan_route(prices, coords, (35.7, 51.4))[0]
        self.assertEqual((fewest['shop_count'], fewest['total']), (9, 90))
        self.assertEqual([s['shop'] for s in fewest['stops']], [f's{i}' for i in range(9)])
        self.assertEqual(visit_order([], COORDS), ([], 0))

    def test_api_plans_saved_products(self):
        Shop.objects.filter(pk='shop_two').update(lat=35.8)
        raw = Offer.objects.get(pk='offer_laptop').raw | dict(offer_id='offer_laptop2', shop_id='shop_two')
        Offer.objects.create(id='offer_laptop2', product_id='product_laptop', shop_id='shop_two', price=3_500_000, changed='', raw=raw)
        Offer.objects.filter(pk='offer_phone').update(price=3_000_000)
        Offer.objects.filter(pk='offer_laptop').update(price=3_000_000)
        Product.objects.create(id='product_unsold', title='بدون فروشنده', category='گوشی موبایل', raw={})
        data = self.client.get('/api/route-plan', {'ids': 'product_phone,product_laptop,product_unsold,product_gone', 'lat': '35.7', 'lon': '51.4'}).json()
        kinds = {p['kind']: p for p in data['plans']}
        self.assertEqual((kinds['fewest']['shop_count'], kinds['fewest']['total']), (1, 5_500_000), 'the cheaper of two single-shop options')
        self.assertEqual((kinds['fewest']['stops'][0]['shop']['id'], kinds['fewest']['stops'][0]['shop']['contacts_synthetic']), ('shop_two', True))
        self.assertEqual({i['product']['id'] for i in kinds['fewest']['stops'][0]['items']}, {'product_phone', 'product_laptop'})
        self.assertEqual((kinds['cheapest']['total'], kinds['cheapest']['shop_count']), (5_000_000, 2))
        self.assertEqual(([p['id'] for p in data['missing']], data['unknown'], data['located']), (['product_unsold'], 1, True))

    def test_api_validation(self):
        for ids in ['product_phone', ','.join(f'product_x{i}' for i in range(13)), 'bad,worse']:
            self.assertEqual(self.client.get('/api/route-plan', {'ids': ids}).status_code, 400)
        self.assertEqual(self.client.get('/api/route-plan', {'ids': 'product_phone,product_laptop', 'lat': '999', 'lon': '1'}).status_code, 400)

    def test_nearest_metro_station(self):
        stations = [{'name': 'دور', 'lat': 35.80, 'lon': 51.40}, {'name': 'نزدیک', 'lat': 35.701, 'lon': 51.401}]
        self.assertEqual(nearest_station(35.70, 51.40, stations)['name'], 'نزدیک')
        self.assertIsNone(nearest_station(35.70, 51.40, stations[:1]), 'farther than 2 km is not offered as nearby')
        self.assertIsNone(nearest_station(35.70, 51.40, []))
        metro = self.client.get('/api/shops/shop_one').json()['metro']
        self.assertTrue(metro['name'] and 0 <= metro['distance_km'] <= 2, 'shops carry the nearest real station from the snapshot')

