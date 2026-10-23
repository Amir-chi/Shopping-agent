import json
import os
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase

from catalog import ai, services
from catalog.domain import outfit_score, styling_eligible, styling_profile
from catalog.models import Offer, Product, Shop
from catalog.outfits import DEFAULTS, _key, review_candidates, safe_image
from .fixtures import seed


class StylingRulesTests(SimpleTestCase):
    def test_personal_color_style_and_fit_preferences_are_enforced(self):
        blue = self.profile('تیشرت زنانه آبی آزاد', 'تاپ و تیشرت زنانه')
        red = self.profile('تیشرت زنانه قرمز جذب', 'تاپ و تیشرت زنانه')
        prefs = DEFAULTS | dict(audience='women', liked_colors=['آبی'], fit='relaxed')
        self.assertTrue(styling_eligible(blue, prefs))
        self.assertFalse(styling_eligible(red, prefs))
        patterned = self.profile('تیشرت زنانه آبی طرح دار', 'تاپ و تیشرت زنانه')
        self.assertFalse(styling_eligible(patterned, prefs | dict(aesthetic='minimal')))
        self.assertFalse(styling_eligible(blue, prefs | dict(fit='fitted')))

    def test_openai_completion_limit_uses_supported_parameter(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{}'
        with patch.dict(os.environ, {'AI_API_KEY': 'test-only'}), patch('catalog.ai.urllib.request.urlopen', return_value=Response()) as request:
            ai._post('openai/gpt-6-luna', [], 10, 3000)
        sent = json.loads(request.call_args.args[0].data)
        self.assertEqual(sent['max_completion_tokens'], 3000)
        self.assertNotIn('max_tokens', sent)
        with patch.dict(os.environ, {'AI_API_KEY': 'test-only'}), patch('catalog.ai.urllib.request.urlopen', return_value=Response()) as request:
            ai._post('deepseek/deepseek-v4.1-flash-1017', [], 10, 3000)
        sent = json.loads(request.call_args.args[0].data)
        self.assertEqual(sent['max_tokens'], 3000)
        self.assertEqual(sent['response_format'], {'type': 'json_object'})
        self.assertNotIn('max_completion_tokens', sent)

    def profile(self, title, category):
        return styling_profile(dict(persian_title=title, category_name=category, specs='[]'))

    def test_formal_rejects_sportswear_and_unknown_is_not_unisex(self):
        p = self.profile('هودی زنانه مشکی', 'هودی و سویشرت')
        self.assertFalse(styling_eligible(p, DEFAULTS | dict(audience='women', style='formal')))
        self.assertTrue(styling_eligible(p, DEFAULTS | dict(audience='women')))
        unknown = self.profile('هودی مشکی', 'هودی و سویشرت')
        self.assertFalse(styling_eligible(unknown, DEFAULTS | dict(audience='women')))
        unknown['unisex'] = True
        self.assertTrue(styling_eligible(unknown, DEFAULTS | dict(audience='women')))

    def test_coverage_season_color_and_onepiece(self):
        crop = self.profile('کراپ زنانه سفید', 'نیم تنه و کراپ زنانه')
        self.assertFalse(styling_eligible(crop, DEFAULTS | dict(audience='women', coverage='covered')))
        warm = self.profile('شومیز زنانه نخی سفید', 'شومیز و تونیک زنانه')
        self.assertFalse(styling_eligible(warm, DEFAULTS | dict(audience='women', season='cold')))
        self.assertEqual(self.profile('سرهمی زنانه مشکی', 'شلوار و سرهمی زنانه')['slot'], 'onepiece')
        self.assertEqual(self.profile('شلوار جین زنانه آبی', 'شلوار و لگ')['kind'], 'jeans')
        self.assertFalse(styling_eligible(self.profile('شومیز زنانه قرمز', 'شومیز و تونیک زنانه'),
                                        DEFAULTS | dict(audience='women', palette='neutral')))
        conflict = styling_profile(dict(persian_title='شلوار زنانه سبز', category_name='شلوار و لگ',
                                        specs=json.dumps([dict(key='رنگ', value='مشکی')], ensure_ascii=False)))
        self.assertTrue(conflict['color_conflict'])
        self.assertIsNone(conflict['color'])
        self.assertFalse(styling_eligible(conflict, DEFAULTS | dict(audience='women')))

    def test_incompatible_pairs_and_missing_color_do_not_get_rewards(self):
        def piece(kind, color):
            return dict(attributes=dict(kind=kind, color=color, patterned=False), product=dict(images=[]))
        self.assertEqual(outfit_score([piece('jogger', 'مشکی'), piece('heels', 'مشکی')], 'any')[0], 0)
        self.assertLess(outfit_score([piece('shirt', None), piece('trousers', None)], 'any')[0], 65)
        self.assertEqual(outfit_score([piece('shirt', 'قرمز'), piece('trousers', 'سبز')], 'any')[0], 0)

    def test_quality_precedes_shop_count_and_images_are_allowlisted(self):
        a = dict(score=90, same_shop=False, shop_count=2, span_km=1, total=500000, id='a')
        b = dict(score=70, same_shop=True, shop_count=1, span_km=0, total=100000, id='b')
        self.assertLess(_key(a), _key(b))
        self.assertTrue(safe_image('https://image.torob.com/base/a.jpg'))
        for url in ['http://image.torob.com/a', 'https://localhost/a', 'https://127.0.0.1/a',
                    'https://image.torob.com.evil.test/a', 'https://image.torob.com:bad/a',
                    'https://user:secret@image.torob.com/a', 'https://image.torob.com/a?token=x']:
            self.assertFalse(safe_image(url))


class OutfitIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        cls.add('blouse', 'شومیز زنانه سفید', 'شومیز و تونیک زنانه')
        cls.add('skirt', 'دامن زنانه مشکی', 'دامن زنانه')
        cls.add('hoodie', 'هودی زنانه مشکی', 'هودی و سویشرت')
        cls.add('heels', 'کفش پاشنه بلند زنانه مشکی', 'کفش پاشنه بلند و مجلسی زنانه')
        cls.add('onepiece', 'سرهمی زنانه مشکی', 'شلوار و سرهمی زنانه')

    @classmethod
    def add(cls, pid, title, category, sid='shop_one'):
        raw = dict(product_id=pid, persian_title=title, category_name=category, specs='[]', image_urls='[]')
        p = Product.objects.create(id=pid, title=title, category=category, raw=raw, low=100000, high=100000, stores=1)
        Offer.objects.create(id='offer_'+pid, product=p, shop_id=sid, price=100000, raw={})
        return p

    def setUp(self):
        cache.clear()

    def test_real_formal_results_and_onepiece_templates(self):
        data = services.outfits(dict(audience='women', style='formal'))
        self.assertTrue(data['items'])
        for outfit in data['items']:
            self.assertNotIn('hoodie', [i['attributes']['kind'] for i in outfit['items']])
            roles = [i['role'] for i in outfit['items']]
            if 'onepiece' in roles:
                self.assertNotIn('top', roles)
                self.assertNotIn('bottom', roles)
            self.assertEqual(outfit['total'], sum(i['price'] for i in outfit['items']))

    def test_fixed_product_budget_and_strict_same_shop(self):
        self.assertTrue(services.outfits(dict(audience='women', seed='onepiece'))['items'])
        self.assertFalse(services.outfits(dict(audience='women', style='formal', seed='hoodie'))['items'])
        self.assertFalse(services.outfits(dict(audience='women', budget='1000'))['items'])
        Offer.objects.filter(product_id__in=['heels', 'product_shoes']).update(shop_id='shop_two')
        self.assertFalse(services.outfits(dict(audience='women', multi='0'))['items'])
        self.assertTrue(services.outfits(dict(audience='women', multi='1'))['items'])
        with self.assertRaises(ValueError):
            services.outfits(dict(seed='onepiece', fixed='blouse'))

    def test_model_only_called_on_explicit_review(self):
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable) as model:
            self.assertEqual(services.outfits(dict(audience='women'))['review']['status'], 'not_requested')
            model.assert_not_called()
            data = services.outfits(dict(audience='women', review='1'))
            self.assertEqual(data['review']['status'], 'unavailable')
            self.assertTrue(data['items'])
            model.assert_called_once()

    def test_all_rejected_gets_a_second_round_and_no_model_name_is_returned(self):
        from catalog import outfits
        real = outfits._distinct
        with patch.object(outfits, '_distinct', lambda c, limit, fixed=(): (real(c, limit, fixed) * 8)[:limit]):
            pool = outfits._distinct(list(services.outfits(dict(audience='women', multi='1'))['items']), 12)
            first = ([], dict(status='reviewed', image_count=3, rejected_reasons=['a']))
            second = ([pool[6]], dict(status='reviewed', image_count=2, rejected_reasons=['b']))
            with patch.object(outfits, 'review_candidates', side_effect=[first, second]) as review:
                data = services.outfits(dict(audience='women', multi='1', review='1'))
        self.assertEqual(review.call_count, 2)
        self.assertEqual(len(review.call_args_list[1].args[0]), 6, 'the second round reviews the next six outfits')
        self.assertEqual((len(data['items']), data['review']['image_count'], data['review']['rejected_reasons']), (1, 5, ['a', 'b']))
        self.assertNotIn('model', data['review'])
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            self.assertNotIn('model', services.outfits(dict(audience='women', review='1'))['review'])

    def test_review_ignores_invented_ids_prices_and_unproven_visual_claims(self):
        candidates = services.outfits(dict(audience='women'))['items']
        c = candidates[0]
        answer = dict(reviews=[dict(id='invented', accept=True, score=100),
                               dict(id=c['id'], accept=True, score=90, visual=True, reason='هماهنگ', total=1),
                               dict(id=c['id'], accept=True, score=100, visual=True)])
        with patch.object(ai, 'chat_json', return_value=answer):
            accepted, review = review_candidates(candidates, DEFAULTS | dict(audience='women'))
        self.assertEqual(review['status'], 'reviewed')
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0]['total'], c['total'])
        self.assertFalse(accepted[0]['review']['visual'])

    def test_rejection_is_empty_but_malformed_json_falls_back_honestly(self):
        candidates = services.outfits(dict(audience='women'))['items']
        for answer in [dict(reviews='bad'), dict(reviews=[dict(id=[], accept=True, score=99)])]:
            with patch.object(ai, 'chat_json', return_value=answer):
                accepted, review = review_candidates(candidates, DEFAULTS)
            self.assertEqual(review['status'], 'invalid_response')
            self.assertEqual(accepted, candidates)
        with patch.object(ai, 'chat_json', return_value=dict(reviews=[dict(id=c['id'], accept=False) for c in candidates])):
            accepted, review = review_candidates(candidates, DEFAULTS)
        self.assertEqual(review['status'], 'reviewed')
        self.assertEqual(accepted, [])

    def test_multimodal_request_is_bounded_and_does_not_send_location_or_price(self):
        candidates = services.outfits(dict(audience='women'))['items']
        for c in candidates:
            for i in c['items']:
                i['product']['images'] = ['https://image.torob.com/base/'+i['product']['id']+'.jpg']
        c = candidates[0]
        with patch.object(ai, 'chat_json', return_value=dict(reviews=[dict(id=c['id'], accept=True, score=85, visual=True)])) as model:
            accepted, review = review_candidates(candidates, DEFAULTS)
        content = model.call_args.args[1]
        self.assertTrue(any(p['type'] == 'image_url' for p in content))
        text = content[0]['text']
        for private in ('shop_id', 'total', 'price', 'lat', 'lon'):
            self.assertNotIn('"'+private+'"', text)
        self.assertTrue(accepted[0]['review']['visual'])
        self.assertLessEqual(review['image_count'], 18)
        self.assertEqual(model.call_args.kwargs['max_output_tokens'], 3000)

    def test_api_validation_and_review_rate_limit(self):
        for params in [dict(season='wrong'), dict(coverage='wrong'), dict(style='formal', occasion='sport'), dict(review='yes')]:
            self.assertEqual(self.client.get('/api/outfits', params).status_code, 400)
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            for _ in range(8):
                self.assertEqual(self.client.get('/api/outfits', dict(audience='women', review='1')).status_code, 200)
            self.assertEqual(self.client.get('/api/outfits', dict(audience='women', review='1')).status_code, 429)
        self.assertEqual(self.client.get('/api/outfits', dict(audience='women')).status_code, 200)

    def test_requested_colors_must_appear_not_only_neutral_substitutes(self):
        self.add('pink', 'شومیز زنانه صورتی آزاد', 'شومیز و تونیک زنانه')
        data = services.outfits(dict(audience='women', liked_colors='صورتی', fit='relaxed'))
        self.assertTrue(data['items'])
        for outfit in data['items']:
            self.assertIn('صورتی', [i['attributes']['color'] for i in outfit['items']])
        self.assertFalse(services.outfits(dict(audience='women', liked_colors='بنفش'))['items'])
        for params in [dict(liked_colors='madeup'), dict(liked_colors='مشکی,سفید,آبی,سبز'),
                       dict(aesthetic='wrong'), dict(fit='wrong'), dict(aesthetic='classic', occasion='sport'),
                       dict(aesthetic='sporty', occasion='work')]:
            self.assertEqual(self.client.get('/api/outfits', params).status_code, 400)

    def test_model_receives_actual_style_color_and_fit_answers(self):
        with patch.object(ai, 'chat_json', side_effect=ai.Unavailable) as model:
            services.outfits(dict(audience='women', aesthetic='minimal', liked_colors='سفید', fit='relaxed', review='1'))
        self.assertTrue(model.called)
        sent = json.loads(model.call_args.args[1][0]['text'])['preferences']
        self.assertEqual(sent['aesthetic'], 'minimal')
        self.assertEqual(sent['liked_colors'], ['سفید'])
        self.assertEqual(sent['fit'], 'relaxed')
