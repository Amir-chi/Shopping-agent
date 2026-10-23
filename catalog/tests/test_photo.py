import base64
import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase

from catalog import ai
from .fixtures import seed

JPEG = 'data:image/jpeg;base64,' + base64.b64encode(b'\xff\xd8\xff' + b'\0' * 2000).decode()


class PhotoSearchTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        cache.clear()

    def post(self, body):
        return self.client.post('/api/photo-search', json.dumps(body), content_type='application/json')

    def ask(self, seen):
        with patch.object(ai, 'chat_json', return_value=seen) as model:
            data = self.post({'image': JPEG}).json()
        return data, model

    def test_visible_brand_and_model_find_the_catalog_item(self):
        data, model = self.ask({'is_product': True, 'product_type': 'گوشی موبایل', 'brand': 'گلکسی', 'model': 'A55',
                                'keywords': ['Galaxy', 'A55'], 'department': 'mobile', 'confidence': 'high', 'seen': 'نوشتهٔ پشت گوشی'})
        self.assertEqual((data['status'], data['match'], [p['id'] for p in data['items']]), ('found', 'exact', ['product_phone']))
        self.assertEqual(data['understood']['department'], 'mobile')
        self.assertEqual(model.call_args.kwargs['cache_seconds'], 0, 'the photo answer is not kept')

    def test_looser_matches_are_labelled(self):
        data, _ = self.ask({'is_product': True, 'product_type': 'گوشی موبایل', 'brand': 'اپل', 'model': 'X1', 'keywords': 7, 'confidence': 'maybe'})
        self.assertEqual((data['status'], data['match'], data['understood']['confidence']), ('found', 'type', 'low'))
        data, _ = self.ask({'is_product': True, 'product_type': 'یخچال', 'brand': 'ناشناخته', 'department': 'evil'})
        self.assertEqual((data['status'], data['items'], data['understood']['department']), ('no_match', [], None))

    def test_non_product_and_unavailable_model(self):
        self.assertEqual(self.ask({'is_product': False})[0], dict(status='not_product', items=[]))
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            self.assertEqual(self.post({'image': JPEG}).json(), dict(status='unavailable', items=[]))

    def test_invalid_photos_never_reach_the_model(self):
        with patch.object(ai, 'chat_json') as model:
            for body in [{'image': 'https://example.com/a.jpg'}, {}, []]:
                self.assertEqual(self.post(body).status_code, 400)
        model.assert_not_called()
