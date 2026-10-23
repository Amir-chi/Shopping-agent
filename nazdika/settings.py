"""One Django application, PostgreSQL only; configuration comes from the environment."""
import json
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from .env import load_local_env

load_local_env()

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if len(SECRET_KEY) < 32 or SECRET_KEY.startswith('REPLACE_'):
    raise ImproperlyConfigured('Set DJANGO_SECRET_KEY to a random value of at least 32 characters.')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]').split(',')
CSRF_TRUSTED_ORIGINS = list(filter(None, os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',')))
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'django.contrib.postgres', 'catalog',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'nazdika.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'nazdika.wsgi.application'
DATABASES = {'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': os.environ.get('POSTGRES_DB', 'nazdika'),
    'USER': os.environ.get('POSTGRES_USER', 'nazdika'),
    'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
    'HOST': os.environ.get('POSTGRES_HOST', 'db'),
    'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    'CONN_MAX_AGE': 60, 'CONN_HEALTH_CHECKS': True,
    'OPTIONS': {'connect_timeout': 10},
}}
password = DATABASES['default']['PASSWORD']
if len(password) < 16 or password.startswith('REPLACE_'):
    raise ImproperlyConfigured('Set a random POSTGRES_PASSWORD of at least 16 characters.')
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'assets']
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
DATA_UPLOAD_MAX_MEMORY_SIZE = 1_048_576
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'no-referrer'
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', 'false').lower() == 'true'
SESSION_COOKIE_SECURE = os.environ.get('DJANGO_SECURE_COOKIES', 'false').lower() == 'true'
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
# Only enable behind a trusted proxy that overwrites this header.
if os.environ.get('DJANGO_TRUST_PROXY', 'false').lower() == 'true':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
try:
    MERCHANT_FEED_KEYS = json.loads(os.environ.get('NAZDIKA_FEED_KEYS', '{}'))
except ValueError as error:
    raise ImproperlyConfigured('NAZDIKA_FEED_KEYS must be a JSON object.') from error
if not isinstance(MERCHANT_FEED_KEYS, dict):
    raise ImproperlyConfigured('NAZDIKA_FEED_KEYS must be a JSON object.')
LOGGING = {'version': 1, 'disable_existing_loggers': False,
           'handlers': {'console': {'class': 'logging.StreamHandler'}},
           'root': {'handlers': ['console'], 'level': 'WARNING'}}
