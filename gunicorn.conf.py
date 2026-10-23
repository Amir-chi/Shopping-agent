import os
import threading
import urllib.request

bind = '0.0.0.0:8000'
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))
threads = int(os.environ.get('GUNICORN_THREADS', '2'))
timeout = 120
accesslog = '-'
errorlog = '-'
# No searches, GPS coordinates, headers or tokens in the access log.
access_log_format = '%(m)s %(U)s %(s)s %(L)s'


def when_ready(server):
    # Warm the in-process caches (bootstrap, home rails, shop counts) so the first visitor after a restart does not wait.
    def warm():
        for path in ('/api/bootstrap', '/api/home', '/api/shops?limit=6'):
            try:
                urllib.request.urlopen('http://127.0.0.1:8000' + path, timeout=180).read()
            except OSError:
                pass
    threading.Thread(target=warm, daemon=True).start()
