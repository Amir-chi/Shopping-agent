import json
import os
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from catalog import ai, video_reviews as reviews
from catalog.models import Metadata, Product, VideoReviewCache
from .fixtures import seed


VIDEO = 'AbCdEf123_-'
OTHER = 'XyZ987abc_-'
CAPTION = 'The Galaxy A55 battery lasted longer in my testing, but your usage may be different.'


def video(vid=VIDEO, title='Samsung Galaxy A55 review', channel='GSMArena Official'):
    return dict(type='video', id=vid, title=title, channel=dict(name=channel, id='UC' + 'a' * 22),
                uploadDate='2025-01-01T12:00:00Z')


def answer(**overrides):
    return {'points': [dict(text='به گفتهٔ بررسی‌کننده، باتری A55 در آزمون او دوام بیشتری داشت.', source_id=VIDEO,
                            segment=0, evidence='The Galaxy A55 battery lasted longer in my testing', kind='strength') | overrides]}


class VideoReviewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        Product.objects.create(id='product_phone2', title='گوشی گلکسی A56', category='گوشی موبایل', raw={}, stores=1)

    def setUp(self):
        cache.clear()
        self.env = patch.dict(os.environ, {'SUPADATA_API_KEY': 'test-provider-key', 'SUPADATA_FALLBACK_KEYS': '',
                                          'AI_API_KEY': 'test-model-key',
                                          'VIDEO_REVIEW_SUMMARIES': 'true', 'SUPADATA_DAILY_LIMIT': '6', 'SUPADATA_MONTHLY_LIMIT': '60'})
        self.env.start()
        self.addCleanup(self.env.stop)

    def get(self, phase='discover', ids='product_phone'):
        response = self.client.get('/api/video-reviews', dict(ids=ids, phase=phase))
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def provider(self, path, params):
        if path == 'youtube/search':
            return dict(results=[video()])
        self.assertEqual(path, 'transcript')
        self.assertEqual(params['mode'], 'native', 'Never charge for ASR fallback')
        self.assertEqual(params['url'], 'https://www.youtube.com/watch?v=' + VIDEO)
        return dict(content=[dict(text=CAPTION, offset=75400, duration=9000)], lang='en')

    def test_missing_key_is_honest_search_link_not_fake_video(self):
        with patch.dict(os.environ, {'SUPADATA_API_KEY': ''}), patch.object(reviews, '_get') as provider:
            result = self.get()
        self.assertEqual(result['status'], 'not_configured')
        self.assertEqual(result['sources'], [])
        self.assertTrue(result['search_links'][0]['url'].startswith('https://www.youtube.com/results?'))
        provider.assert_not_called()

    def test_boundary_validation_and_unsupported_categories(self):
        for args in ({}, {'ids': VIDEO}, {'ids': 'product_phone', 'phase': 'download'},
                     {'ids': 'product_phone,'}, {'ids': ','.join(['product_phone'] * 4)}):
            self.assertEqual(self.client.get('/api/video-reviews', args).status_code, 400)
        self.assertEqual(self.client.get('/api/video-reviews', {'ids': 'product_absent'}).status_code, 404)
        with patch.object(reviews, '_get') as provider:
            self.assertEqual(self.get(ids='product_top')['status'], 'unsupported')
            self.assertEqual(self.get(ids='product_phone,product_laptop')['status'], 'unsupported')
        provider.assert_not_called()

    def test_discovery_does_not_fetch_captions_or_model(self):
        with patch.object(reviews, '_get', side_effect=self.provider) as provider, patch.object(ai, 'chat_json') as model:
            result = self.get()
        self.assertEqual(result['status'], 'found')
        self.assertEqual(result['sources'][0]['id'], VIDEO)
        self.assertEqual(provider.call_count, 1)
        model.assert_not_called()

    def test_exact_model_variants_and_networks(self):
        base = dict(id='p', name='Samsung Galaxy A55 5G', model='a 55', brand='سامسونگ', category='گوشی موبایل')
        target = reviews.identity(base)
        self.assertTrue(reviews.matches(target, 'Samsung Galaxy A55 review'))
        self.assertTrue(reviews.matches(target, 'Galaxy A55 5G review'))
        for title in ('Samsung A56 review', 'Samsung A55s review', 'Galaxy A55 Pro review', 'Galaxy A55 4G review'):
            self.assertFalse(reviews.matches(target, title), title)
        fe = reviews.identity(base | dict(name='Samsung S25 FE 5G', model='s 25 fe'))
        self.assertTrue(reviews.matches(fe, 'Samsung S25 FE vs S25 review'))
        self.assertFalse(reviews.matches(fe, 'Samsung S25 Ultra review'))
        plain = reviews.identity(base | dict(name='Samsung S25', model='s25'))
        self.assertTrue(reviews.matches(plain, 'Samsung S25 vs S25 Ultra review'))
        self.assertFalse(reviews.matches(plain, 'Samsung S25 Ultra review'))
        self.assertFalse(reviews.matches(plain, 'Otherbrand S25 review'))

    def test_unsafe_ids_and_accessory_reviews_are_rejected(self):
        rows = [video('javascript:x'), video(title='Galaxy A55 case review'), video(title='Galaxy A56 review'), video()]
        with patch.object(reviews, '_get', return_value=dict(results=rows)):
            result = self.get()
        self.assertEqual([s['id'] for s in result['sources']], [VIDEO])
        self.assertTrue(result['sources'][0]['url'].startswith('https://www.youtube.com/watch?v='))

    def test_direct_comparison_and_individual_fallback_are_distinct(self):
        with patch.object(reviews, '_get', return_value=dict(results=[video(title='Galaxy A55 vs Galaxy A56 comparison')])) as provider:
            result = self.get(ids='product_phone,product_phone2')
        self.assertEqual(result['scope'], 'head_to_head')
        self.assertEqual(provider.call_count, 1)
        VideoReviewCache.objects.all().delete()

        def separate(path, params):
            query = params['query']
            if ' vs ' in query:
                return dict(results=[video()])  # One model cannot masquerade as a direct comparison.
            return dict(results=[video()] if 'a55' in query else [video(OTHER, 'Samsung Galaxy A56 review')])
        with patch.object(reviews, '_get', side_effect=separate) as provider:
            result = self.get(ids='product_phone,product_phone2')
        self.assertEqual(result['scope'], 'individual')
        self.assertEqual(len(result['sources']), 2)
        self.assertEqual(provider.call_count, 3)

    def test_no_native_text_preserves_real_video_links_without_calling_model(self):
        def no_text(path, params):
            return dict(results=[video()]) if path == 'youtube/search' else dict(content=[])
        with patch.object(reviews, '_get', side_effect=no_text), patch.object(ai, 'chat_json') as model:
            result = self.get('summary')
        self.assertEqual(result['status'], 'links_only')
        self.assertEqual(result['reason'], 'no_transcript')
        self.assertEqual(result['sources'][0]['transcript_status'], 'unavailable')
        self.assertEqual(result['points'], [])
        model.assert_not_called()

    def test_missing_model_key_keeps_links_without_buying_captions(self):
        with patch.dict(os.environ, {'AI_API_KEY': ''}), patch.object(reviews, '_get', side_effect=self.provider) as provider:
            result = self.get('summary')
        self.assertEqual(result['status'], 'links_only')
        self.assertEqual(provider.call_count, 1, 'Search only; no caption expense when summarization is disabled')

    def test_summary_has_validated_timestamps_and_cache_survives_local_cache_clear(self):
        with patch.object(reviews, '_get', side_effect=self.provider) as provider, patch.object(ai, 'chat_json', return_value=answer()) as model:
            result = self.get('summary')
            self.assertEqual(result['status'], 'summarized')
            point = result['points'][0]
            self.assertEqual(point['start'], 75)
            self.assertEqual(point['url'], 'https://www.youtube.com/watch?v=' + VIDEO + '&t=75s')
            self.assertNotIn('evidence', point, 'Do not republish transcript excerpts')
            cache.clear()
            self.assertEqual(self.get('summary'), result)
            self.get()
            self.assertEqual(provider.call_count, 2, 'Persistent search and transcript caches')
            self.assertEqual(model.call_count, 1)
            self.assertIn(CAPTION, model.call_args.args[1])
            self.assertNotIn('price', json.loads(model.call_args.args[1])['products'][0])

    def test_model_output_cannot_invent_sources_quotes_timestamps_or_prices(self):
        invalid = [answer(source_id=OTHER)['points'][0],
                   answer(evidence='This was never said in the video')['points'][0],
                   answer(text='قیمت امروز ۱۰۰ تومان است')['points'][0],
                   answer(evidence='!!!!!!!!!!!!!!!')['points'][0]]
        with patch.object(reviews, '_get', side_effect=self.provider), patch.object(ai, 'chat_json', return_value={'points': invalid}):
            result = self.get('summary')
        self.assertEqual(result['status'], 'links_only')
        self.assertEqual(result['points'], [])
        self.assertEqual(len(result['sources']), 1)

    def test_quotes_are_located_server_side_across_merged_caption_lines(self):
        lines = [dict(text=f'filler line number {i} about nothing', offset=i * 3000) for i in range(60)]
        # Lines 44/45 fall on a 25-second block boundary.
        lines[44:46] = [dict(text='honestly the fingerprint reader', offset=132000),
                        dict(text='sometimes gets stuck for me', offset=135000)]
        def provider(path, params):
            return dict(results=[video()]) if path == 'youtube/search' else dict(content=lines)
        # Wrong block hint, quote straddling two caption lines, duplicate quote, unknown kind/product, bad topic.
        point = dict(text='به گفتهٔ بررسی‌کننده حسگر اثرانگشت گاهی گیر می‌کند.', source_id=VIDEO, block=0,
                     evidence='fingerprint reader sometimes gets stuck', kind='weakness', topic='اثرانگشت',
                     product_id='product_other')
        points = [point, point | dict(kind='nonsense'), point | dict(evidence='filler line number 59 about', topic='http://x', kind='x')]
        with patch.object(reviews, '_get', side_effect=provider), patch.object(ai, 'chat_json', return_value={'points': points}) as model:
            result = self.get('summary')
        self.assertEqual(model.call_args.kwargs['reasoning_effort'], 'low')
        self.assertGreaterEqual(model.call_args.kwargs['max_output_tokens'], 8000, 'Reasoning must not exhaust the output cap')
        first, last = result['points']
        self.assertEqual((first['start'], first['kind'], first['topic'], first['product_id']), (132, 'weakness', 'اثرانگشت', 'product_phone'))
        self.assertEqual((last['start'], last['kind'], last['topic']), (177, 'caution', None), 'Cite the exact caption line')
        self.assertFalse(result['partial'])

    def test_long_transcripts_are_sampled_across_the_whole_video(self):
        blocks = reviews._blocks([dict(text='x' * 400, start=i * 30) for i in range(200)])
        sampled, partial = reviews._sample(blocks, budget=16000)
        self.assertTrue(partial)
        self.assertEqual((sampled[0]['start'], sampled[-1]['start']), (0, 199 * 30), 'Keep the closing verdict')
        self.assertLessEqual(sum(len(b['text']) for b in sampled), 16000)

    def test_single_product_gets_two_channels_and_skips_shorts(self):
        rows = [video('Short000000', channel='A') | dict(duration=40), video(), video(OTHER, channel='GSMArena Official'),
                video('Third000000', channel='Other channel') | dict(uploadDate='2 years ago', duration=600)]
        with patch.object(reviews, '_get', return_value=dict(results=rows)):
            result = self.get()
        self.assertEqual([s['id'] for s in result['sources']], [VIDEO, 'Third000000'])
        self.assertEqual((result['sources'][1]['published_label'], result['sources'][1]['duration']), ('۲ سال پیش', 600))

    def test_provider_and_model_errors_keep_catalog_and_links_usable(self):
        with patch.object(reviews, '_get', side_effect=reviews.Unavailable):
            self.assertEqual(self.get()['status'], 'unavailable')
        VideoReviewCache.objects.all().delete()
        with patch.object(reviews, '_get', side_effect=self.provider), patch.object(ai, 'chat_json', side_effect=ai.Unavailable):
            result = self.get('summary')
        self.assertEqual(result['status'], 'links_only')
        self.assertEqual(result['reason'], 'summary_unavailable')
        self.assertEqual(result['sources'][0]['id'], VIDEO)
        row = VideoReviewCache.objects.filter(payload__reason='summary_unavailable').get()
        self.assertLess(row.expires_at, timezone.now() + timedelta(seconds=100))

    def test_lease_returns_pending_and_never_doubles_provider_calls(self):
        fingerprint = [(p['id'], p['query']) for p in [reviews.identity(dict(
            id='product_phone', name='گوشی گلکسی A55', model=None, brand=None, category='گوشی موبایل'))]]
        config_id = reviews.hashlib.sha256(b'test-provider-key').hexdigest()[:12]
        VideoReviewCache.objects.create(key=reviews._key('search-v2', config_id, fingerprint), expires_at=timezone.now(),
                                        locked_until=timezone.now() + timedelta(seconds=90))
        with patch.object(reviews, '_get') as provider:
            result = self.get()
        self.assertEqual(result['status'], 'pending')
        provider.assert_not_called()

    def test_native_http_request_is_fixed_bounded_and_does_not_generate(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit):
                self.limit = limit
                return json.dumps({'content': [], 'lang': 'en'}).encode()
        response = Response()
        with patch('catalog.video_reviews.urllib.request.urlopen', return_value=response) as opened:
            reviews._get('transcript', {'url': 'https://www.youtube.com/watch?v=' + VIDEO, 'mode': 'native', 'text': 'false'})
        request = opened.call_args.args[0]
        self.assertTrue(request.full_url.startswith('https://api.supadata.ai/v1/transcript?'))
        self.assertIn('mode=native', request.full_url)
        self.assertNotIn('test-provider-key', request.full_url)
        self.assertEqual(response.limit, 2_000_001)
        self.assertEqual(opened.call_args.kwargs['timeout'], 10)

    def test_video_requests_have_separate_rate_budget(self):
        cache.set('video-rate:127.0.0.1', 40, 600)
        self.assertEqual(self.client.get('/api/video-reviews', {'ids': 'product_phone'}).status_code, 429)
        self.assertEqual(self.client.get('/api/products/product_phone').status_code, 200)

    def test_paused_summaries_do_not_buy_transcripts(self):
        with patch.dict(os.environ, {'VIDEO_REVIEW_SUMMARIES': 'false'}), patch.object(reviews, '_get', side_effect=self.provider) as provider, patch.object(ai, 'chat_json') as model:
            result = self.get('summary')
        self.assertEqual(result['reason'], 'summary_paused')
        self.assertEqual(len(result['sources']), 1)
        self.assertEqual(provider.call_count, 1)
        model.assert_not_called()

    def test_search_page_is_reused_across_catalog_configurations(self):
        with patch.object(reviews, '_get', side_effect=self.provider) as provider:
            first = reviews.identity(dict(id='one', name='Samsung Galaxy A55', category='گوشی موبایل'))
            second = first | dict(id='two')
            self.assertTrue(reviews._search('Samsung Galaxy A55 review', [first]))
            cache.clear()
            self.assertEqual(reviews._search('Samsung Galaxy A55 review', [second])[0]['product_ids'], ['two'])
        self.assertEqual(provider.call_count, 1, 'Provider pages are shared, coverage is recalculated for the current product')

    def test_native_and_search_caches_last_longer_without_rebilling(self):
        with patch.object(reviews, '_get', side_effect=self.provider), patch.object(ai, 'chat_json', return_value=answer()):
            self.get('summary')
        native = VideoReviewCache.objects.get(pk=reviews._key('native-v1', VIDEO))
        self.assertGreater(native.expires_at, timezone.now() + timedelta(days=29))
        self.assertGreater(VideoReviewCache.objects.filter(payload__results__isnull=False).get().expires_at,
                           timezone.now() + timedelta(days=6))

    def test_daily_and_monthly_budget_persist_in_database(self):
        with patch.dict(os.environ, {'SUPADATA_DAILY_LIMIT': '2'}):
            reviews._reserve_request()
            cache.clear()
            reviews._reserve_request()
            with self.assertRaises(reviews.BudgetExceeded):
                reviews._reserve_request()
        row = Metadata.objects.get(pk='supadata_request_budget')
        used = json.loads(row.value)
        self.assertEqual((used['daily'], used['monthly']), (2, 2))
        used['day'] = 'previous-day'
        row.value = json.dumps(used)
        row.save()
        with patch.dict(os.environ, {'SUPADATA_MONTHLY_LIMIT': '2'}), self.assertRaises(reviews.BudgetExceeded):
            reviews._reserve_request()
        with patch.dict(os.environ, {'SUPADATA_MONTHLY_LIMIT': '3'}):
            reviews._reserve_request()
        self.assertEqual(json.loads(Metadata.objects.get(pk=row.pk).value)['daily'], 1)

    def test_budget_stop_preserves_search_links_and_never_calls_provider(self):
        with patch.dict(os.environ, {'SUPADATA_DAILY_LIMIT': '0'}), patch('catalog.video_reviews.urllib.request.urlopen') as provider:
            result = self.get()
        self.assertEqual(result['status'], 'budget_limited')
        self.assertTrue(result['search_links'])
        provider.assert_not_called()

    def test_expensive_modes_are_blocked_before_reserving_or_sending(self):
        with patch('catalog.video_reviews.urllib.request.urlopen') as provider:
            for path, params in [('extract', {}), ('transcript', {'mode': 'auto'}), ('transcript', {'mode': 'generate'}),
                                 ('youtube/search', {'limit': 100})]:
                with self.assertRaises(reviews.Unavailable):
                    reviews._get(path, params)
        self.assertFalse(Metadata.objects.filter(pk='supadata_request_budget').exists())
        provider.assert_not_called()

    def test_auth_errors_pause_other_product_requests(self):
        import urllib.error
        error = urllib.error.HTTPError('https://api.supadata.ai/v1/youtube/search', 401, 'Unauthorized', {}, None)
        with patch('catalog.video_reviews.urllib.request.urlopen', side_effect=error) as provider:
            for _ in range(2):
                with self.assertRaises(reviews.Unavailable):
                    reviews._get('youtube/search', {'limit': 20})
        self.assertEqual(provider.call_count, 1, 'A bad key is not retried once per catalog product')

    def test_fallback_key_is_used_only_when_primary_is_capped_or_refused(self):
        import urllib.error

        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b'{"results": []}'
        sent = lambda provider: [call.args[0].get_header('X-api-key') for call in provider.call_args_list]
        with patch.dict(os.environ, {'SUPADATA_FALLBACK_KEYS': 'fallback-key, test-provider-key', 'SUPADATA_DAILY_LIMIT': '1'}):
            with patch('catalog.video_reviews.urllib.request.urlopen', return_value=Response()) as provider:
                for _ in range(2):
                    reviews._get('youtube/search', {'limit': 20})
                with self.assertRaises(reviews.BudgetExceeded):
                    reviews._get('youtube/search', {'limit': 20})
            self.assertEqual(sent(provider), ['test-provider-key', 'fallback-key'], 'Primary first, duplicate keys ignored')
            Metadata.objects.all().delete()
            error = urllib.error.HTTPError('https://api.supadata.ai/v1/youtube/search', 429, 'Too Many', {}, None)
            with patch('catalog.video_reviews.urllib.request.urlopen', side_effect=[error, Response()]) as provider:
                reviews._get('youtube/search', {'limit': 20})
            self.assertEqual(sent(provider), ['test-provider-key', 'fallback-key'], 'A refused account fails over in the same request')
        budgets = {row.pk: json.loads(row.value)['daily'] for row in Metadata.objects.all()}
        self.assertEqual(budgets['supadata_request_budget'], 1, 'Primary keeps its original budget row')
        self.assertEqual(len(budgets), 2, 'Each account is capped separately')
