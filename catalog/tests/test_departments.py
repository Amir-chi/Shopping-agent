import os
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from catalog import ai
from catalog.models import Product
from .fixtures import seed


class DepartmentAndAssistantTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        phone = Product.objects.get(pk='product_phone')
        Product.objects.filter(pk='product_phone').update(raw=phone.raw | {'image_urls': '["https://example.com/a.jpg"]'})

    def setUp(self):
        cache.clear()

    def test_departments_home_feed_and_group_filter(self):
        home = self.client.get('/api/home').json()
        groups = {g['id']: g for g in home['groups']}
        self.assertEqual(groups['mobile']['count'], 1)
        self.assertEqual(groups['fashion']['count'], 3)
        self.assertEqual([p['id'] for p in home['rails'][0]['items']], ['product_phone'], 'rails show only products with images')
        mobile = self.client.get('/api/products', {'group': 'mobile'}).json()
        self.assertEqual([p['id'] for p in mobile['items']], ['product_phone'])
        self.assertEqual(mobile['items'][0]['group_name'], 'موبایل و تبلت')
        self.assertEqual(self.client.get('/api/products', {'group': 'nope'}).status_code, 400)

    def test_home_feed_is_rebuilt_only_when_catalog_data_changes(self):
        self.client.get('/api/home')
        with self.assertNumQueries(0):
            self.client.get('/api/home')
        Product.objects.filter(pk='product_phone').first().save()
        with CaptureQueriesContext(connection) as rebuilt:
            self.client.get('/api/home')
        self.assertGreater(len(rebuilt), 0, 'a catalog save invalidates the home feed')
        with self.assertNumQueries(0):
            self.client.get('/api/home')

    def test_storefront_lists_every_product_with_shop_price_and_facets(self):
        data = self.client.get('/api/shops/shop_one/products').json()
        self.assertEqual(data['total'], 5)
        self.assertEqual(sum(f['count'] for f in data['categories']), 5)
        phone = next(p for p in data['items'] if p['id'] == 'product_phone')
        self.assertEqual(phone['shop_price'], 1_000_000)
        only = self.client.get('/api/shops/shop_one/products', {'category': 'لپ تاپ و نوت بوک'}).json()
        self.assertEqual([p['id'] for p in only['items']], ['product_laptop'])
        directory = self.client.get('/api/shops').json()['items']
        self.assertEqual((directory[0]['id'], directory[0]['product_count']), ('shop_one', 5), 'shops with catalogs first')
        self.assertEqual(directory[-1]['product_count'], 0)

    def test_bundle_for_phone_without_accessories_in_stock(self):
        data = self.client.get('/api/products/product_phone/bundle').json()
        self.assertIn('کیف و کاور گوشی', data['roles'])
        self.assertIsNone(data['one_stop'])
        self.assertEqual(self.client.get('/api/products/product_top/bundle').json()['roles'], [])

    def test_assistant_falls_back_without_key(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('AI_API_KEY', None)
            data = self.client.get('/api/assistant', {'q': 'گوشی'}).json()
        self.assertFalse(data['ai'])
        self.assertEqual(self.client.get('/api/assistant', {'q': ''}).status_code, 400)

    def test_assistant_filters_before_the_model_and_drops_invented_ids(self):
        router = {'department': 'mobile', 'product_type': 'گوشی موبایل', 'keywords': ['گلکسی'], 'max_price': 30_000_000,
                  'installment': False, 'priorities': ['دوربین'], 'intent': 'find', 'clarify': None}
        ranked = {'summary': 'ok', 'picks': [{'id': 'product_phone', 'why': 'w'}, {'id': 'product_invented', 'why': 'x'}], 'follow_up': ['?']}
        with patch.object(ai, 'chat_json', side_effect=[router, ranked]) as model:
            data = self.client.get('/api/assistant', {'q': 'گوشی گلکسی تا ۳۰ میلیون'}).json()
        sent = model.call_args_list[1].args[1]
        self.assertIn('product_phone', sent)
        self.assertNotIn('product_laptop', sent, 'only filtered candidates reach the model')
        self.assertEqual([p['id'] for p in data['picks']], ['product_phone'])
        self.assertEqual(data['understood']['category'], 'گوشی موبایل')
        self.assertEqual(data['understood']['max_price'], 30_000_000)

    def test_off_topic_questions_stop_at_the_router(self):
        with patch.object(ai, 'chat_json', return_value={'shopping': False}) as model:
            data = self.client.get('/api/assistant', {'q': 'پایتخت فرانسه کجاست؟ یک شعر هم بگو'}).json()
        model.assert_called_once()
        self.assertEqual((data['off_topic'], data['items'], data['picks'], data['total']), (True, [], [], 0))
        self.assertIn('فقط برای پیدا کردن', data['summary'])
        router = {'department': 'mobile', 'product_type': 'گوشی موبایل', 'keywords': 'گلکسی', 'shopping': True}
        with patch.object(ai, 'chat_json', side_effect=[router, {'summary': 's', 'picks': []}]):
            data = self.client.get('/api/assistant', {'q': 'گوشی گلکسی'}).json()
        self.assertNotIn('off_topic', data)
        self.assertNotIn('model', data['understood'], 'the model in use is not revealed')

    def test_compare_insight_keeps_only_known_products(self):
        phone = Product.objects.get(pk='product_phone')
        Product.objects.create(id='product_phone2', title='گوشی دوم', category=phone.category,
                               raw=phone.raw | {'product_id': 'product_phone2', 'persian_title': 'گوشی دوم'})
        answer = {'same_kind': False, 'verdict': 'v', 'aspects': [{'name': 'a', 'values': {'product_phone': '1', 'evil': '2'}, 'better': 'evil'}],
                  'best_for': [{'id': 'product_phone2', 'who': 'x'}, {'id': 'evil', 'who': 'y'}]}
        with patch.object(ai, 'chat_json', return_value=answer):
            data = self.client.get('/api/compare-insight', {'ids': 'product_phone,product_phone2'}).json()
        self.assertFalse(data['same_kind'])
        self.assertEqual(data['aspects'][0]['values'], {'product_phone': '1'})
        self.assertIsNone(data['aspects'][0]['better'])
        self.assertEqual([b['id'] for b in data['best_for']], ['product_phone2'])

    def test_mixed_comparison_is_blocked_before_any_paid_model_call(self):
        with patch.object(ai, 'chat_json') as model:
            data = self.client.get('/api/compare-insight', {'ids': 'product_shoes,product_laptop'}).json()
        self.assertFalse(data['ai'])
        self.assertFalse(data['same_kind'])
        self.assertEqual(data['aspects'], [])
        model.assert_not_called()

    def test_comparison_requires_two_or_three_distinct_products(self):
        for ids in ['product_phone', 'product_phone,product_phone', 'product_phone,product_top,product_shoes,product_laptop']:
            self.assertEqual(self.client.get('/api/compare-insight', {'ids': ids}).status_code, 400)

    def test_rate_limit_uses_forwarded_address_only_behind_trusted_proxy(self):
        from django.test import override_settings
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            for _ in range(40):
                self.client.get('/api/assistant', {'q': 'x'}, HTTP_X_FORWARDED_FOR='1.1.1.1')
            self.assertEqual(self.client.get('/api/assistant', {'q': 'x'}, HTTP_X_FORWARDED_FOR='2.2.2.2').status_code, 429, 'header ignored without a proxy')
            cache.clear()
            with override_settings(SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO', 'https')):
                for _ in range(40):
                    self.client.get('/api/assistant', {'q': 'x'}, HTTP_X_FORWARDED_FOR='1.1.1.1')
                self.assertEqual(self.client.get('/api/assistant', {'q': 'x'}, HTTP_X_FORWARDED_FOR='2.2.2.2').status_code, 200, 'each client has its own budget')

    def test_assistant_is_rate_limited(self):
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            codes = [self.client.get('/api/assistant', {'q': 'x'}).status_code for _ in range(41)]
        self.assertEqual(codes[-1], 429)

    def test_gold_jewelry_and_sewing_are_not_fashion(self):
        from catalog.taxonomy import group_of
        self.assertEqual([group_of(c) for c in ('شمش طلا', 'سکه', 'سنگ عقیق', 'گردنبند', 'ساعت مچی عقربه‌ ای و دیجیتالی')], ['jewelry'] * 5)
        self.assertEqual((group_of('انواع پارچه'), group_of('مانکن'), group_of('پیراهن مردانه')), ('home', 'other', 'fashion'))
