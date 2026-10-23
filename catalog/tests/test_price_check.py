import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from catalog import ai
from catalog.domain import parse_price, price_position
from catalog.models import Product
from .fixtures import seed


class PriceCheckTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        cache.clear()

    def test_shopper_price_input(self):
        for text, price in [('۲۶٫۵ میلیون', 26_500_000), ('26,500,000 تومان', 26_500_000), ('۱۵۰۰ هزار', 1_500_000),
                            ('۲۶/۵ میلیون تومن', 26_500_000), ('۲۶٬۵۰۰٬۰۰۰', 26_500_000), ('۱٫۲ میلیارد', 1_200_000_000), ('999', None), ('ارزان', None), ('', None), ('20000000000', None)]:
            self.assertEqual(parse_price(text), price, text)

    def test_position_levels(self):
        prices = [100, 200, 300, 400, 500, 600]
        self.assertEqual([price_position(p, prices)['level'] for p in (50, 100, 300, 400, 600, 700)],
                         ['below', 'low', 'typical', 'typical', 'high', 'above'])
        self.assertEqual(price_position(250, prices) | {}, dict(level='typical', cheaper_shops=2, shops=6, low=100, median=300, high=600))

    def test_api_compares_one_price_per_shop_and_reports_dates(self):
        data = self.client.get('/api/products/product_phone/price-check', {'price': '۱٫۵ میلیون'}).json()
        self.assertEqual((data['level'], data['cheaper_shops'], data['shops'], data['low'], data['high']), ('typical', 1, 2, 1_000_000, 2_000_000))
        self.assertEqual(data['newest_change'], '2026-01-01T00:00:00+00:00')
        self.assertEqual(self.client.get('/api/products/product_phone/price-check', {'price': 'خیلی'}).status_code, 400)
        summary = self.client.get('/api/products/product_phone/price-check').json()
        self.assertEqual((summary['level'], summary['shops'], summary['low'], summary['median'], summary['high']), (None, 2, 1_000_000, 1_000_000, 2_000_000), 'no price: the recorded range only')
        self.assertEqual(self.client.get('/api/products/product_nothing/price-check', {'price': '1000000'}).status_code, 404)

    def test_product_without_usable_prices_says_so(self):
        Product.objects.create(id='product_bare', title='بدون قیمت', category='گوشی موبایل', raw={})
        self.assertEqual(self.client.get('/api/products/product_bare/price-check', {'price': '1000000'}).json(),
                         dict(price=1_000_000, level='no_data', shops=0))

    def test_need_reaches_the_model_and_its_pick_is_validated(self):
        phone = Product.objects.get(pk='product_phone')
        Product.objects.create(id='product_phone2', title='گوشی دوم', category=phone.category, raw=phone.raw | {'persian_title': 'گوشی دوم'})
        for pick, expected in [({'id': 'product_phone2', 'why': 'w' * 300}, 'product_phone2'), ({'id': 'evil', 'why': 'x'}, None)]:
            with patch.object(ai, 'chat_json', return_value={'verdict': 'v', 'for_need': pick}) as model:
                data = self.client.get('/api/compare-insight', {'ids': 'product_phone,product_phone2', 'need': ' عکاسی در شب ' + 'x' * 300}).json()
            sent = json.loads(model.call_args.args[1])
            self.assertEqual(len(sent['need']), 160)
            self.assertEqual(data['for_need'] and data['for_need']['id'], expected)
        self.assertEqual(len(data['need']), 160)
        with patch.object(ai, 'chat_json', return_value={'verdict': 'v', 'for_need': {'id': 'product_phone'}}) as model:
            data = self.client.get('/api/compare-insight', {'ids': 'product_phone,product_phone2'}).json()
        self.assertIsInstance(json.loads(model.call_args.args[1]), list, 'without a need the request is unchanged')
        self.assertIsNone(data['for_need'])

    @override_settings(MERCHANT_FEED_KEYS={'shop_two': 'k' * 32})
    def test_shop_reports_live_price_connection(self):
        self.assertTrue(self.client.get('/api/shops/shop_two').json()['live_prices'])
        self.assertFalse(self.client.get('/api/shops/shop_one').json()['live_prices'])

    def test_web_prices_keep_only_seen_plausible_distinct_shops(self):
        offers = [dict(source='الف', url='https://torob.com/p/1', price_toman=1_200_000),
                  dict(source='الف', url='https://torob.com/p/1', price_toman=1_100_000),       # same shop twice
                  dict(source='ب', url='https://invented.ir/x', price_toman=1_000_000),        # page the search never saw
                  dict(source='پ', url='https://shop.ir/a55-case', price_toman=90_000),          # a part, not the phone
                  dict(source='ت', url='javascript:alert(1)', price_toman=1_000_000),
                  dict(source='ث', url='https://www.shop.ir/a55', price_toman=1_050_000)]
        found = dict(answer=dict(offers=offers), seen=['https://torob.com/p/1', 'https://shop.ir/'], at='2026-10-23T10:00+00:00')
        with patch.object(ai, 'web_search_json', return_value=found):
            data = self.client.get('/api/products/product_phone/web-prices').json()
        self.assertEqual([(o['source'], o['host'], o['price']) for o in data['offers']], [('الف', 'torob.com', 1_200_000), ('ث', 'shop.ir', 1_050_000)])
        self.assertEqual(data['checked_at'], '2026-10-23T10:00+00:00')
        with patch.object(ai, 'web_search_json', side_effect=ai.Unavailable):
            self.assertEqual(self.client.get('/api/products/product_phone/web-prices').json(), dict(offers=[], available=False))
        self.assertEqual(self.client.get('/api/products/product_nothing/web-prices').status_code, 404)
