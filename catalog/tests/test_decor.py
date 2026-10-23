import base64
import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase

from catalog import ai
from catalog.decor import product_colors
from catalog.models import Product
from .fixtures import seed

JPEG = 'data:image/jpeg;base64,' + base64.b64encode(b'\xff\xd8\xff' + b'\0' * 2000).decode()


def microwave(pid, color, stores=1):
    specs = json.dumps([{'key': 'رنگ', 'value': color}, {'key': 'رنگ نور', 'value': 'سفید'}], ensure_ascii=False)
    raw = dict(product_id=pid, persian_title='مایکروویو ' + pid, category_name='مایکروویو', specs=specs, image_urls='[]')
    Product.objects.create(id=pid, title=raw['persian_title'], category='مایکروویو', raw=raw, low=5_000_000, high=5_000_000, stores=stores)


class ColorAdviceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        microwave('product_mw_white', 'سفید')
        microwave('product_mw_black', 'مشکی', stores=3)
        microwave('product_mw_silver', 'سیلور / رز گلد')

    def setUp(self):
        cache.clear()

    def post(self, body, **headers):
        return self.client.post('/api/color-advice', json.dumps(body), content_type='application/json', **headers)

    def test_colors_come_from_color_specs_not_light_color(self):
        self.assertEqual(product_colors(Product.objects.get(pk='product_mw_silver').raw), ['رزگلد', 'نقره ای'])
        self.assertEqual(product_colors(Product.objects.get(pk='product_mw_black').raw), ['مشکی'])

    def test_model_picks_are_limited_to_palette_and_alternatives_come_from_database(self):
        answer = {'room_colors': ['کابینت سفید'], 'recommended': ['بنفش نئونی', 'مشکی', 'مشکی'], 'avoid': ['مشکی', 'سفید', 'قرمز', 'آبی'],
                  'reason': 'r' * 500, 'caution': 'نور عکس'}
        with patch.object(ai, 'chat_json', return_value=answer) as model:
            data = self.post({'product_id': 'product_mw_white', 'image': JPEG}).json()
        sent = json.loads(model.call_args.args[1][0]['text'])
        self.assertEqual(sent['product']['recorded_colors'], ['سفید'])
        self.assertEqual(model.call_args.kwargs['cache_seconds'], 0, 'the photo answer is not kept')
        self.assertEqual((data['status'], data['recommended'], data['avoid'], data['match']), ('advised', ['مشکی'], ['سفید', 'قرمز'], 'mismatch'))
        self.assertEqual(len(data['reason']), 240)
        self.assertEqual([p['id'] for p in data['alternatives']], ['product_mw_black'])

    def test_matching_product_needs_no_alternatives(self):
        with patch.object(ai, 'chat_json', return_value={'recommended': ['سفید']}):
            data = self.post({'product_id': 'product_mw_white', 'image': JPEG}).json()
        self.assertEqual((data['match'], data['alternatives'], data['caution']), ('match', [], None))

    def test_non_room_invalid_and_unavailable_answers_are_honest(self):
        for answer, status in [({'not_room': True}, 'not_room'), ({'recommended': 'سفید'}, 'invalid_response')]:
            with patch.object(ai, 'chat_json', return_value=answer):
                self.assertEqual(self.post({'product_id': 'product_mw_white', 'image': JPEG}).json()['status'], status)
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            self.assertEqual(self.post({'product_id': 'product_mw_white', 'image': JPEG}).json()['status'], 'unavailable')

    def test_boundary_validation_before_any_model_call(self):
        fake_png = 'data:image/png;base64,' + base64.b64encode(b'\xff\xd8\xff' + b'\0' * 2000).decode()
        with patch.object(ai, 'chat_json') as model:
            self.assertEqual(self.post({'product_id': 'product_phone', 'image': JPEG}).status_code, 400, 'appliances only')
            self.assertEqual(self.post({'product_id': 'product_missing', 'image': JPEG}).status_code, 404)
            for image in [fake_png, 'https://example.com/a.jpg', 'data:image/jpeg;base64,!!!', None]:
                self.assertEqual(self.post({'product_id': 'product_mw_white', 'image': image}).status_code, 400)
            self.assertEqual(self.client.post('/api/color-advice', 'x', content_type='text/plain').status_code, 415)
            self.assertEqual(self.client.get('/api/color-advice').status_code, 405)
        model.assert_not_called()

    def test_photo_requests_are_rate_limited(self):
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            codes = [self.post({'product_id': 'product_mw_white', 'image': JPEG}).status_code for _ in range(9)]
        self.assertEqual(codes[-1], 429)
