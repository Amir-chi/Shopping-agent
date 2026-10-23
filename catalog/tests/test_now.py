import json
from datetime import datetime
from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from catalog.domain import TEHRAN, next_opening
from catalog.models import Shop
from .fixtures import seed

DAY = lambda start, end: dict(status='declared', shifts=[dict(start_time=start, end_time=end)])
WEEK = lambda start, end: {d: DAY(start, end) for d in ('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri')}


class NowTests(TestCase):
    """«همین الان»: who is open at a chosen hour, who is closed and when it opens."""
    @classmethod
    def setUpTestData(cls):
        seed()
        for sid, hours, lat in [('shop_one', WEEK('09:00:00', '22:00:00'), 35.71), ('shop_two', WEEK('09:00:00', '14:00:00'), 35.701)]:
            shop = Shop.objects.get(pk=sid)
            shop.raw = shop.raw | dict(weekly_hours=json.dumps(hours))
            shop.lat = lat
            shop.save()

    def setUp(self):
        cache.clear()

    def ask(self, at, **extra):
        return self.client.get('/api/now', dict(q='گوشی گلکسی', lat=35.7, lon=51.4, at=at, day='wed') | extra)

    def test_evening_one_open_one_closed(self):
        data = self.ask('21:00').json()
        self.assertEqual((data['kind'], data['categories']), ('open_near', ['گوشی موبایل']))
        self.assertEqual([s['id'] for s in data['open']], ['shop_one'])
        self.assertEqual((data['closed'][0]['id'], data['closed'][0]['next_open']), ('shop_two', 'فردا ساعت 09:00'))
        self.assertEqual(data['open'][0]['offer']['price'], 1_000_000)

    def test_late_night_nothing_open(self):
        data = self.ask('23:30').json()
        self.assertEqual((data['kind'], data['open']), ('none_open', []))
        self.assertEqual(data['soonest']['next_open'], 'فردا ساعت 09:00')

    def test_model_picks_only_real_categories(self):
        answers = [dict(department='mobile', shopping=True), dict(categories=['گوشی موبایل', 'دسته‌ای که نیست'])]
        with mock.patch('catalog.ai.chat_json', side_effect=answers):
            data = self.ask('21:00', q='یه گوشی خوب').json()
        self.assertEqual((data['categories'], data['kind']), (['گوشی موبایل'], 'open_near'))
        with mock.patch('catalog.ai.chat_json', return_value=dict(shopping=False)):
            self.assertEqual(self.ask('21:00', q='یه شعر بگو').json()['kind'], 'unknown_item')

    def test_validation(self):
        self.assertEqual(self.client.get('/api/now', {'q': 'گوشی'}).status_code, 400, 'a place is needed')
        self.assertEqual(self.ask('25:00').status_code, 400)
        self.assertEqual(self.ask('10:00', day='someday').status_code, 400)
        self.assertEqual(self.ask('10:00', q='zzqqxx').json()['kind'], 'unknown_item')

    def test_next_opening_labels(self):
        now = datetime(2026, 10, 21, 23, 30, tzinfo=TEHRAN)
        self.assertEqual(next_opening({'thu': DAY('00:00:00', '06:00:00')}, now)[2], '30 دقیقهٔ دیگر')
        self.assertEqual(next_opening({'sat': DAY('10:00:00', '20:00:00')}, now)[2], 'شنبه ساعت 10:00')
        self.assertIsNone(next_opening({}, now))
