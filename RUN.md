# اجرا و عملیات نسخه Django/PostgreSQL

نقطه شروع اصلی [README.md](README.md) است. اجرای قبلی SQLite جایگزین شده؛ سایت Docker روی http://127.0.0.1:8000 است.

## دستورات روزمره

```powershell
docker compose up -d --build
docker compose ps
docker compose logs --tail 50 web
docker compose stop
```

`stop` داده را حذف نمی‌کند. پایگاه PostgreSQL در volume به نام `nazdika_postgres_data` باقی می‌ماند. از حذف volume برای رفع خطای معمول استفاده نکنید. پیش از هر عملیات مخرب یا ارتقای نسخه عمده PostgreSQL بکاپ مستقل لازم است.

در اولین اجرا: آماده‌شدن PostgreSQL ← اجرای migrations ← ورود اتمیک منبع در صورت خالی‌بودن ← جمع‌آوری فایل‌های static مدیریت ← Gunicorn. ناموجودبودن فایل منبع یا خطای ورود، startup را متوقف می‌کند؛ به نسخه نمایشی یا SQLite برنمی‌گردد.

## انتقال دستی در کاتالوگ خالی

اگر ورود اولیه را دستی می‌خواهید، `CATALOG_AUTO_IMPORT=false` بگذارید و پس از migrations اجرا کنید:

```powershell
docker compose exec -T web python manage.py import_catalog --sqlite /import/catalog.sqlite3
```

یا:

```powershell
docker compose exec -T web python manage.py import_catalog --zip /import/torob-dataset.zip
```

داده باید در `data/` میزبان باشد که فقط خواندنی mount می‌شود. واردکردن روی کاتالوگ موجود ممنوع است؛ `--if-empty` در صورت وجود import کامل صرفاً بدون تغییر خارج می‌شود. تاریخچه و وضعیت قیمت قدیمی SQLite نیز در صورت وجود منتقل می‌شوند.

## صحت داده و تست

```powershell
docker compose exec -T web python manage.py verify_catalog --compare-source /import/catalog.sqlite3
docker compose exec -T web python manage.py test catalog.tests --noinput
docker compose exec -T web python manage.py makemigrations --check --dry-run
node test_frontend.cjs
```

`verify_catalog` تعدادها، قیمت‌های تجمیعی، جست‌وجوی فارسی، ارتباط کالا/فروشگاه و مسیر ست/محدوده را بررسی می‌کند. گزینه مقایسه منبع، digest مستقل از ترتیبِ تمام فیلدهای خام هر سه جدول را مقایسه می‌کند؛ برای دیتاست بزرگ چند دقیقه زمان لازم است.

## سلامت و مدیریت

- `/api/health`: ۲۰۰ فقط وقتی PostgreSQL قابل دسترس و ورود کاتالوگ کامل باشد؛ در غیر این صورت ۵۰۳.
- `/admin/`: ورود مدیر با حسابی که خودتان ایجاد می‌کنید. داده‌های واردشده و رویدادها فقط مشاهده می‌شوند.
- `/api/price-status`: وضعیت واقعی دریافت گزارش، نه فرض متصل‌بودن فروشگاه‌ها.

```powershell
docker compose exec web python manage.py createsuperuser
docker compose exec -T web python manage.py check --deploy
```

برای انتشار عمومی، هشدارهای متناسب با HTTPS و پراکسی را رفع کنید. Compose فعلی پیش‌فرض محلی دارد؛ تغییر host و دامنه، تنظیم HTTPS و بکاپ وظیفه مرحله انتشار است. access log برنامه query string یا موقعیت دقیق را چاپ نمی‌کند؛ پراکسی هم باید همین سیاست را داشته باشد.
