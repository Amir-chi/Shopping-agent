import time
from unittest import mock

from django.test import SimpleTestCase, override_settings

from catalog import ai


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class DeadlineTests(SimpleTestCase):
    def test_a_slow_answer_falls_back_within_the_timeout(self):
        def slow(*args, **kwargs):
            time.sleep(3)
        with mock.patch.dict('os.environ', {'AI_API_KEY': 'x'}), mock.patch('urllib.request.urlopen', side_effect=slow):
            started = time.monotonic()
            with self.assertRaises(ai.Unavailable):
                ai.chat_json('system', 'slow question', timeout=1, cache_seconds=1)
        self.assertLess(time.monotonic() - started, 2.5, 'the caller never waits past its timeout')
