from django.contrib.postgres.search import SearchVector
from django.core.cache import cache
from django.test import TestCase

from catalog.domain import similar_options, split_budget, tier_options
from catalog.models import Product


def listing(pid, category, price, stores=1):
    Product.objects.create(id=pid, title=pid, category=category, low=price, high=price, stores=stores,
                           raw=dict(product_id=pid, persian_title=pid, category_name=category, specs='[]', image_urls='[]'))


class DowryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for i, price in enumerate([100_000_000, 150_000_000, 200_000_000]):
            listing(f'product_tv{i}', 'تلویزیون', price, stores=3 - i)
        for i, price in enumerate([5_000_000, 10_000_000, 15_000_000, 500]):
            listing(f'product_iron{i}', 'اتو', price)

    def setUp(self):
        cache.clear()

    def test_split_follows_median_prices_and_tiers_follow_price_order(self):
        self.assertEqual(split_budget(160, {'tv': 150, 'iron': 10}), {'tv': 150, 'iron': 10})
        self.assertEqual(split_budget(100, {}), {})
        picks = tier_options(100, [('cheap', 200, 1), ('mid', 210, 1)])
        self.assertEqual([(p['tier'], p['product']) for p in picks], [('economy', 'cheap'), ('balanced', 'mid')], 'a sparse category never labels the pricier pick economy')

    def test_plan_for_a_budget(self):
        data = self.client.get('/api/dowry', {'budget': '۱۶۰ میلیون', 'items': 'tv,iron,carpet,unknown'}).json()
        tv, iron = data['items']
        self.assertEqual((tv['label'], tv['share'], iron['share']), ('تلویزیون', 150_000_000, 10_000_000))
        self.assertEqual([o['tier'] for o in tv['options']], ['economy', 'balanced', 'better'])
        self.assertEqual([o['product']['id'] for o in tv['options']], ['product_tv0', 'product_tv1', 'product_tv2'])
        self.assertEqual(iron['cheapest'], 5_000_000, 'a suspect price never counts')
        self.assertEqual(data['tiers'], dict(economy=105_000_000, balanced=160_000_000, better=215_000_000))
        self.assertEqual((data['cheapest_total'], data['missing']), (105_000_000, ['فرش ماشینی']))
        self.assertEqual(tv['similar'], [], 'listings already shown as tiers are not repeated as similar')

    def test_own_items_map_to_a_category(self):
        Product.objects.filter(pk='product_tv0').update(search_text='lg smart')
        Product.objects.update(search_document=SearchVector('search_text', config='simple'))
        data = self.client.get('/api/dowry', {'budget': '۱۶۰ میلیون', 'extra': 'lg، چیزی که نیست'}).json()
        self.assertEqual([(i['label'], i['options'][0]['product']['category']) for i in data['items']], [('lg', 'تلویزیون')])
        self.assertEqual(data['missing'], ['چیزی که نیست'])

    def test_similar_listings_sit_near_the_share(self):
        near = similar_options(100, [('a', 90, 1), ('far', 300, 1), ('c', 110, 1), ('shown', 105, 1)], {'shown'}, limit=2)
        self.assertEqual([o['product'] for o in near], ['a', 'c'], 'nearest to the share, cheapest first, excluding picks')
        self.assertEqual(similar_options(0, [('a', 90, 1)], set()), [dict(product='a', price=90)], 'a zero share never divides by zero')

    def test_checklist_and_validation(self):
        catalog = self.client.get('/api/dowry').json()['catalog']
        self.assertIn(dict(key='cooler', label='کولر گازی', default=False), catalog)
        self.assertNotIn('items', self.client.get('/api/dowry').json())
        for params in [{'budget': 'زیاد', 'items': 'tv'}, {'budget': '100000000', 'items': 'nothing'}]:
            self.assertEqual(self.client.get('/api/dowry', params).status_code, 400)
