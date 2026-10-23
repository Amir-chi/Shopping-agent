import json
from unittest import mock

from django.contrib.postgres.search import SearchVector
from django.core.cache import cache
from django.test import TestCase

from catalog.domain import normalize
from catalog.models import Offer, Product
from .fixtures import seed


def accessory(pid, title, category, price, shop='shop_one'):
    raw = dict(product_id=pid, persian_title=title, category_name=category, specs='[]', image_urls='["https://x/a.jpg"]')
    p = Product.objects.create(id=pid, title=title, category=category, raw=raw, search_text=normalize(title), low=price, high=price, stores=1)
    Offer.objects.create(id='offer_' + pid, product=p, shop_id=shop, price=price, raw=dict(offer_id='offer_' + pid))


class QaFixTests(TestCase):
    """Findings from the 2026-10-23 Codex QA pass."""
    @classmethod
    def setUpTestData(cls):
        seed()
        phone = Product.objects.get(pk='product_phone')
        phone.raw['model'] = 'A 55'
        phone.save(update_fields=['raw'])
        accessory('product_case_ok', 'قاب گوشی سامسونگ A55 سیلیکونی', 'کیف و کاور گوشی', 300_000)
        accessory('product_case_iphone', 'قاب ژله‌ای iPhone SE 2022', 'کیف و کاور گوشی', 100_000)
        accessory('product_charger', 'شارژر دیواری ۲۵ وات', 'شارژر گوشی', 400_000)
        Product.objects.update(search_document=SearchVector('search_text', config='simple'))

    def setUp(self):
        cache.clear()

    def test_bundle_offers_only_cases_named_for_the_model(self):
        data = self.client.get('/api/products/product_phone/bundle').json()
        picks = {p['role']: p['product']['id'] for p in data['one_stop']['items']}
        self.assertEqual(picks['کیف و کاور گوشی'], 'product_case_ok', 'the cheaper iPhone case is not a match')
        self.assertEqual(picks['شارژر گوشی'], 'product_charger', 'generic accessories still come')
        self.assertNotIn('product_case_iphone', [p['id'] for p in data['options']['کیف و کاور گوشی']])

    def test_typo_is_corrected_to_a_common_title_word(self):
        with mock.patch('catalog.services.title_words', return_value=['گلکسی', 'گوشی']):
            data = self.client.get('/api/products', {'q': 'گلکسیی'}).json()
        self.assertEqual((data['total'], data['parsed']['corrected']), (1, 'گلکسی'))
        self.assertIsNone(self.client.get('/api/products', {'q': 'گلکسی'}).json()['parsed']['corrected'])

    def test_compare_sends_specs_named_in_the_need_first(self):
        specs = [dict(key=f'ویژگی {i}', value='x') for i in range(60)] + [dict(key='ظرفیت باتری', value='5000')]
        for pid in ('product_phone', 'product_laptop'):
            p = Product.objects.get(pk=pid)
            p.category, p.raw['specs'] = 'گوشی موبایل', json.dumps(specs, ensure_ascii=False)
            p.save(update_fields=['category', 'raw'])
        with mock.patch('catalog.ai.chat_json', return_value={}) as chat:
            self.client.get('/api/compare-insight', {'ids': 'product_phone,product_laptop', 'need': 'باتری بهتر'})
        sent = json.loads(chat.call_args[0][1])['products'][0]['specs']
        self.assertEqual(next(iter(sent)), 'ظرفیت باتری')
