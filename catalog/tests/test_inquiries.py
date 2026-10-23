import json
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from catalog.models import Inquiry, SearchMiss, Shop
from catalog.seller import issue_code
from .fixtures import seed


class InquiryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        Shop.objects.filter(pk='shop_two').update(categories=['گوشی موبایل'])

    def setUp(self):
        cache.clear()

    def post(self, path, body, token=None):
        headers = {'HTTP_AUTHORIZATION': 'Bearer ' + token} if token else {}
        return self.client.post(path, json.dumps(body), content_type='application/json', **headers)

    def ask(self, **extra):
        body = dict(product_id='product_phone', shop_ids=['shop_one', 'shop_two'], questions=['stock', 'price', 'evil'], note=' سفید؟ ') | extra
        return self.post('/api/inquiries/new', body)

    def seller(self, shop_id):
        code = issue_code(shop_id)
        return self.post('/api/seller/login', dict(shop_id=shop_id, code=code)).json()['token']

    def test_buyer_asks_several_shops_and_only_the_token_reads_answers(self):
        sent = self.ask().json()
        self.assertEqual(len(sent['ids']), 2)
        row = Inquiry.objects.get(pk=sent['ids'][0])
        self.assertNotIn(sent['token'], row.token_hash, 'only a hash of the buyer token is stored')
        self.assertEqual((row.questions, row.note, row.seller_unread), (['stock', 'price'], 'سفید؟', True))
        mine = self.client.get('/api/inquiries', {'tokens': sent['token']}).json()['items']
        self.assertEqual({i['shop']['id'] for i in mine}, {'shop_one', 'shop_two'})
        self.assertEqual((mine[0]['questions'], mine[0]['messages']), (['موجود است؟', 'قیمت امروز چند است؟'], []))
        self.assertEqual(self.client.get('/api/inquiries', {'tokens': 'x' * 30}).json()['items'], [], 'another token sees nothing')
        self.assertEqual(self.client.get('/api/inquiries', {'tokens': 'bad token'}).status_code, 400)

    def test_two_way_thread_reaches_only_that_buyer(self):
        sent = self.ask().json()
        token = self.seller('shop_one')
        target = Inquiry.objects.get(shop_id='shop_one').pk
        out = self.post('/api/seller/shop_one/reply', dict(id=target, available=True, price='۱٫۲ میلیون', text='فقط مشکی'), token).json()
        self.assertEqual((out['available'], out['price'], out['messages'][-1]['sender']), (True, 1_200_000, 'seller'))
        follow = self.post('/api/inquiries/reply', dict(token=sent['token'], id=target, text='  تا کی باز هستید؟ ')).json()
        self.assertEqual([m['sender'] for m in follow['messages']], ['seller', 'buyer'])
        self.assertTrue(Inquiry.objects.get(pk=target).seller_unread, 'a buyer follow-up is unread for the shop again')
        self.assertEqual(self.post('/api/inquiries/reply', dict(token='y' * 30, id=target, text='سلام')).status_code, 404, 'only the asking buyer can write')
        mine = {i['id']: i for i in self.client.get('/api/inquiries', {'tokens': sent['token']}).json()['items']}
        self.assertEqual(mine[target]['messages'][0]['price'], 1_200_000)
        other = [i for i in mine.values() if i['id'] != target][0]
        self.assertEqual(other['messages'], [], 'the other shop sees and sends nothing for this thread')
        self.assertEqual(self.client.get('/api/products/product_phone/stores').json()['items'][0]['price'], 1_000_000, 'answers never become public prices')
        out = self.post('/api/seller/shop_one/reply', dict(id=target, available=False, price='999999999'), token).json()
        self.assertIsNone(out['price'], 'no price is kept for an unavailable item')

    def test_validation(self):
        for extra in [dict(shop_ids=[]), dict(shop_ids=['shop_one'] + [f'shop_x{i}' for i in range(5)]), dict(shop_ids='shop_one'),
                      dict(questions=[], note='')]:
            self.assertEqual(self.ask(**extra).status_code, 400, extra)
        self.assertEqual(self.ask(shop_ids=['shop_missing']).status_code, 404)
        self.assertEqual(self.ask(product_id='product_missing').status_code, 404)
        sent = self.ask().json()
        target = Inquiry.objects.filter(shop_id='shop_one').first().pk
        token = self.seller('shop_one')
        for body in [dict(id=target), dict(id=target, available='yes'), dict(id=target, available=True, price='ارزان')]:
            self.assertEqual(self.post('/api/seller/shop_one/reply', body, token).status_code, 400, body)
        self.assertEqual(self.post('/api/inquiries/reply', dict(token=sent['token'], id=target, text='  ')).status_code, 400)
        self.assertEqual(self.client.post('/api/inquiries/new', 'x', content_type='text/plain').status_code, 415)

    def test_old_inquiries_expire(self):
        sent = self.ask().json()
        Inquiry.objects.update(created_at=timezone.now() - timedelta(days=15))
        self.assertEqual(self.client.get('/api/inquiries', {'tokens': sent['token']}).json()['items'], [])
        self.ask()
        self.assertEqual(Inquiry.objects.count(), 2, 'expired rows are deleted on the next write')

    def test_unmet_demand_is_aggregated_and_scoped_to_the_shop(self):
        for q in ['گوشی تاشو نایاب', 'گوشی تاشو نایاب', 'خودکار طلایی ۰۹۱۲۱۲۳۴۵۶۷', 'تکی']:
            self.assertEqual(self.client.get('/api/products', {'q': q}).json()['total'], 0)
        self.assertFalse(SearchMiss.objects.filter(query__contains='0912').exists(), 'phone-like text is never stored')
        self.ask(shop_ids=['shop_one'])
        one, two = self.seller('shop_one'), self.seller('shop_two')
        self.post('/api/seller/shop_one/reply', dict(id=Inquiry.objects.get().pk, available=False), one)
        demand = self.client.get('/api/seller/shop_two/overview', HTTP_AUTHORIZATION='Bearer ' + two).json()['demand']
        self.assertEqual(demand['searches'], [dict(query='گوشی تاشو نایاب', count=2)], 'only repeated searches, in the shop categories')
        self.assertNotIn('تکی', json.dumps(demand, ensure_ascii=False), 'a one-off search is never shown')
        self.assertEqual(demand['unmet'], [dict(product=dict(id='product_phone', name='گوشی گلکسی A55'), count=1, in_your_shop=True)])
        self.assertEqual(self.client.get('/api/seller/shop_one/overview', HTTP_AUTHORIZATION='Bearer ' + one).json()['demand']['unmet'], [],
                         'own answers are not demand from elsewhere')
