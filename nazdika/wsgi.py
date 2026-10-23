import encodings.idna  # noqa: F401  Load before worker threads: a lazy first import races in getaddrinfo ("unknown encoding: idna").
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nazdika.settings')
application = get_wsgi_application()
