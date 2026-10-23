from unittest.mock import patch

from django.contrib.postgres.search import SearchVector
from django.db.models import Value
from django.test import TestCase

from catalog import ai
from catalog.domain import normalize
from catalog.models import Product, Shop
from .fixtures import seed


class SearchRelevanceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        for i, (title, category) in enumerate([
            ('شارژر گوشی اپل', 'شارژر گوشی'),
            ('قاب گوشی گلکسی A55', 'کیف و کاور گوشی'),
            ('هندزفری بی سیم', 'هدفون، هدست و هندزفری'),
            ('دزدگیر سیم کارتی', 'دوربین مدار بسته'),
        ]):
            Product.objects.create(id='product_extra'+str(i), title=title, category=category, raw={},
                                   low=100_000, high=6_000_000, stores=100, search_text=normalize(title+' '+category))
        for i in range(23):
            Product.objects.create(id='product_mobile'+str(i), title='گوشی اقتصادی '+str(i), category='گوشی موبایل',
                                   raw={}, low=500_000, high=500_000, stores=1, search_text=normalize('گوشی موبایل اقتصادی '+str(i)))
        Product.objects.update(search_document=SearchVector('search_text', config='simple'))

    def test_one_missing_word_is_tolerated_but_never_the_model_code(self):
        Product.objects.create(id='product_a55', title='گوشی سامسونگ (ویتنام) A55', category='گوشی موبایل', raw={}, low=900_000,
                               high=900_000, stores=3, search_document=SearchVector(Value(normalize('گوشی سامسونگ ویتنام A55 گوشی موبایل')), config='simple'))
        data = self.client.get('/api/products', {'q': 'گوشی سامسونگ گلکسی A55'}).json()
        self.assertEqual(({p['id'] for p in data['items']}, data['parsed']['relaxed']), ({'product_a55', 'product_phone'}, True), 'each lacks one word')
        exact = self.client.get('/api/products', {'q': 'سامسونگ A55'}).json()
        self.assertEqual(([p['id'] for p in exact['items']], exact['parsed']['relaxed']), (['product_a55'], False))
        self.assertEqual(self.client.get('/api/products', {'q': 'گوشی سامسونگ گلکسی A99'}).json()['total'], 0, 'a model code is never dropped')
        self.assertEqual(self.client.get('/api/products', {'q': 'گوشی سامسونگ گلکسی A55', 'exact': '1'}).json()['total'], 0)

    def test_phone_search_never_returns_accessories_or_whole_catalog(self):
        for phrase in ('گوشی', 'گوشی تا ۳۰ میلیون'):
            data=self.client.get('/api/products', {'q':phrase}).json()
            self.assertEqual(data['total'],24)
            self.assertTrue(all(p['category']=='گوشی موبایل' for p in data['items']))

    def test_unavailable_model_preserves_relevant_search_and_actual_count(self):
        with patch.object(ai,'chat_json',side_effect=ai.Unavailable):
            data=self.client.get('/api/assistant',{'q':'گوشی'}).json()
        self.assertFalse(data['ai'])
        self.assertEqual(data['total'],24)
        self.assertEqual(len(data['items']),12)
        self.assertTrue(all(p['category']=='گوشی موبایل' for p in data['items']))

    def test_model_cannot_broaden_phone_question_to_mobile_accessories(self):
        route={'department':'digital','keywords':'گوشی','product_type':'لوازم دیجیتال','priorities':[]}
        with patch.object(ai,'chat_json',side_effect=[route,{'picks':[]}]):
            data=self.client.get('/api/assistant',{'q':'گوشی'}).json()
        self.assertEqual(data['total'],24)
        self.assertEqual(len(data['items']),20)
        self.assertTrue(all(p['category']=='گوشی موبایل' for p in data['items']))

    def test_missing_exact_model_is_not_replaced_with_all_phones(self):
        route={'department':'mobile','keywords':'گلکسی A99999','product_type':'گوشی موبایل','priorities':[]}
        with patch.object(ai,'chat_json',return_value=route) as model:
            data=self.client.get('/api/assistant',{'q':'گوشی گلکسی A99999'}).json()
        self.assertEqual(data['items'],[])
        self.assertEqual(data['total'],0)
        self.assertEqual(model.call_count,1,'No ranking call for a nonexistent model')

    def test_explicit_accessory_queries_remain_accessory_queries(self):
        for phrase,category in [('شارژر گوشی','شارژر گوشی'),('قاب گوشی','کیف و کاور گوشی'),('هندزفری بی سیم ارزان','هدفون، هدست و هندزفری')]:
            data=self.client.get('/api/products',{'q':phrase}).json()
            self.assertTrue(data['items'],phrase)
            self.assertTrue(all(p['category']==category for p in data['items']),phrase)

    def test_address_readability_does_not_rewrite_source_or_store_identity(self):
        source='سعادت آباد،اولایا,طبقه همکف،پلاک 14'
        Shop.objects.filter(pk='shop_one').update(address=source)
        response=self.client.get('/api/shops/shop_one').json()
        self.assertEqual(response['address'],'سعادت آباد، اولایا، طبقه همکف، پلاک 14')
        self.assertEqual(response['name'],'shop_one')
        self.assertEqual(Shop.objects.get(pk='shop_one').address,source)
