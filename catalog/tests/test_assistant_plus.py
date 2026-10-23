import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase

from catalog import ai
from catalog.assistant import history_of
from catalog.models import Product
from .fixtures import seed

SPECS = json.dumps([{'key': 'حافظه داخلی', 'value': '256 گیگابایت'}, {'key': 'رم', 'value': '8 گیگابایت'}, {'key': 'باتری', 'value': '5000'}], ensure_ascii=False)


class AssistantPlusTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        phone = Product.objects.get(pk='product_phone')
        Product.objects.filter(pk='product_phone').update(raw=phone.raw | {'image_urls': '["https://image.torob.com/a.jpg"]', 'specs': SPECS})

    def setUp(self):
        cache.clear()

    def test_history_is_sanitized(self):
        raw = json.dumps([{'q': 'x' * 300, 'shown': ['a' * 200, 5, 'b', 'c', 'd']}, {'q': ''}, 'bad', {'q': 'دوم'}, {'q': 'سوم'}, {'q': 'چهارم'}])
        turns = history_of(raw)
        self.assertEqual([t['q'] for t in turns], ['دوم', 'سوم', 'چهارم'], 'only the last three entries are read')
        self.assertEqual(history_of('[{"q": "' + 'x' * 300 + '", "shown": ["' + 'a' * 200 + '", 5]}]')[0], dict(q='x' * 200, shown=['a' * 120]))
        self.assertEqual(history_of('not json'), [])

    def test_follow_up_carries_earlier_turns_and_cheapest_sort(self):
        router = {'department': 'mobile', 'product_type': 'گوشی موبایل', 'keywords': 'گلکسی', 'max_price': None, 'sort': 'cheapest', 'priorities': []}
        ranked = {'summary': 's', 'picks': [{'id': 'product_phone', 'why': 'w'}]}
        history = json.dumps([{'q': 'گوشی گلکسی', 'shown': ['گوشی گلکسی A55 — 5000000 تومان']}], ensure_ascii=False)
        with patch.object(ai, 'chat_json', side_effect=[router, ranked]) as model, \
                patch('catalog.services.search_products', wraps=__import__('catalog.services', fromlist=['x']).search_products) as search:
            data = self.client.get('/api/assistant', {'q': 'ارزون‌ترش', 'history': history}).json()
        sent = json.loads(model.call_args_list[0].args[1])
        self.assertEqual((sent['new_message'], sent['earlier'][0]['q']), ('ارزون‌ترش', 'گوشی گلکسی'))
        first = search.call_args_list[0].args[0]
        self.assertEqual((first['sort'], first['max_price']), ('price_desc', 4_999_999), '"cheaper" caps below what was already shown')
        self.assertTrue(data['followup'])
        self.assertIn('گوشی گلکسی', json.loads(model.call_args_list[1].args[1])['earlier'])

    def test_gift_picks_only_filtered_candidates(self):
        answer = {'summary': 'ok', 'picks': [{'id': 'product_phone', 'why': 'برای عکاسی'}, {'id': 'product_invented'}, {'id': 'product_phone'}]}
        with patch.object(ai, 'chat_json', return_value=answer) as model:
            data = self.client.get('/api/gift', {'relation': 'friend', 'age': 'young', 'interests': 'tech,unknown', 'budget': '۱٫۵ میلیون'}).json()
        candidates = [c['id'] for c in json.loads(model.call_args.args[1])['candidates']]
        self.assertEqual(candidates, ['product_phone'], 'only in-budget products with photos reach the model')
        self.assertEqual(([p['product']['id'] for p in data['picks']], data['profile']['interests']), (['product_phone'], ['تکنولوژی']))
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            self.assertFalse(self.client.get('/api/gift', {'relation': 'friend', 'age': 'young', 'interests': 'tech', 'budget': '1500000'}).json()['ai'])
        for params in [{'relation': 'boss', 'age': 'young', 'interests': 'tech', 'budget': '1000000'},
                       {'relation': 'friend', 'age': 'young', 'interests': 'nothing', 'budget': '1000000'},
                       {'relation': 'friend', 'age': 'young', 'interests': 'tech', 'budget': 'زیاد'},
                       {'relation': 'friend', 'age': 'ancient', 'interests': 'tech', 'budget': '1000000'}]:
            self.assertEqual(self.client.get('/api/gift', params).status_code, 400)

    def test_spec_explanations_keep_to_recorded_specs(self):
        answer = {'points': [{'key': 'رم', 'plain': 'p' * 300, 'matters': 'm'}, {'key': 'پردازنده خیالی', 'plain': 'x'}],
                  'fits_need': {'verdict': 'maybe', 'why': 'w'}}
        with patch.object(ai, 'chat_json', return_value=answer):
            plain = self.client.get('/api/explain-specs', {'id': 'product_phone'}).json()
            needed = self.client.get('/api/explain-specs', {'id': 'product_phone', 'need': 'بازی'}).json()
        self.assertEqual([(p['key'], p['value'], len(p['plain'])) for p in plain['points']], [('رم', '8 گیگابایت', 160)])
        self.assertIsNone(plain['fits_need'], 'no verdict without a stated need')
        self.assertEqual(needed['fits_need'], dict(verdict='maybe', why='w'))
        self.assertEqual(self.client.get('/api/explain-specs', {'id': 'product_laptop'}).json()['reason'], 'no_specs')
        self.assertEqual(self.client.get('/api/explain-specs', {'id': 'product_missing'}).status_code, 404)
