# نزدیکا — Django + PostgreSQL + Docker

نسخه فعلی یک برنامه Django با دیتابیس PostgreSQL و فرانت HTML/CSS/JavaScript است. رابط بازطراحی‌شده سه پالت قابل انتخاب دارد. دستیار، مقایسه، خلاصهٔ ویدئو و بررسی اختیاری ست‌ها از اتصال سروری BoxAPI و مدل `openai/gpt-6-luna` استفاده می‌کنند. دیپ‌سیک با کلید فعلی مجاز نبود و با تأیید کاربر به Luna برگشتیم. جزئیات مقایسه، وضعیت دسترسی و آزمون‌ها: [COMPARISON.md](COMPARISON.md).

## شروع روی همین سیستم

```powershell
docker compose up -d --build
```

سایت: http://127.0.0.1:8000/#home  
سلامت: http://127.0.0.1:8000/api/health  
پنل مدیریت: http://127.0.0.1:8000/admin/

سرور Python قدیمی متوقف شده و پورت ۸۰۰۰ اکنون نسخه Django داخل Docker است؛ آدرس و ذخیره‌های مرورگر قبلی حفظ می‌شوند. برای تغییر پورت، `APP_PORT` را در `.env` تغییر دهید و `docker compose up -d` را اجرا کنید.

## راه‌اندازی روی سیستم تازه

۱. Docker و Compose را نصب و اجرا کنید.
۲. `.env.example` را به `.env` کپی کنید. برای `DJANGO_SECRET_KEY` و `POSTGRES_PASSWORD` دو مقدار تصادفی متفاوت بگذارید؛ مقدارهای نمونه معتبر نیستند. برای تولید هر مقدار می‌توانید `python -c "import secrets; print(secrets.token_urlsafe(48))"` را اجرا کنید. `.env` خصوصی است و در Git یا image قرار نمی‌گیرد.
۳. فایل SQLite قبلی را در `data/catalog.sqlite3` قرار دهید. یا ZIP اصلی را در `data/torob-dataset.zip` بگذارید و `CATALOG_IMPORT_PATH=/import/torob-dataset.zip` تنظیم کنید.
۴. `docker compose up -d --build` را اجرا کنید.
۵. اولین اجرا شامل migration و ورود کامل داده است و بیشتر طول می‌کشد. با `docker compose logs -f web` پیشرفت را ببینید.

ورود داده فقط در کاتالوگ خالی انجام می‌شود، اتمیک است و با ری‌استارت تکرار یا بازنویسی نمی‌شود. SQLite فقط منبع انتقالِ خواندنی است؛ runtime هیچ fallback به SQLite ندارد. ZIP نیز مستقیم پشتیبانی می‌شود. فایل SQLite دارای WAL غیرخالی پذیرفته نمی‌شود؛ باید یک backup checkpoint‌شده بدهید.

## هر بخش کجاست؟

| بخش | محل | وظیفه |
| --- | --- | --- |
| تنظیمات و مسیرهای Django | `nazdika/` | اتصال دیتابیس، امنیت، مسیر API و مدیریت |
| مدل‌ها و migration | `catalog/models.py` و `catalog/migrations/` | ساختار PostgreSQL و تغییرات نسخه‌بندی‌شده |
| API | `catalog/views.py` | اعتبارسنجی درخواست، احراز هویت خوراک و پاسخ HTTP |
| جست‌وجو و پیشنهادها | `catalog/services.py` | منطق متصل به ORM و PostgreSQL |
| قواعد مستقل | `catalog/domain.py` | نرمال‌سازی فارسی، ساعت کار، فاصله و قواعد لباس |
| قیمت و موجودی | `catalog/prices.py` | تاریخچه، تراکنش و قفل‌گذاری گزارش فروشنده |
| انتقال و بررسی دیتاست | `catalog/management/commands/` | ورود SQLite/ZIP و بررسی یکپارچگی |
| فرانت فعلی | `index.html`, `ui.css`, `catalog.js`, `shopping.js` | نمایش و تعامل؛ موقت تا تصمیم طراحی بعدی |
| اجرا | `Dockerfile`, `compose.yaml`, `docker/entrypoint.sh` | ساخت image، بالا‌آوردن سرویس‌ها و ورود اولیه |

نقشه کامل‌تر و وضعیت قابلیت‌ها: [ARCHITECTURE.md](ARCHITECTURE.md). راهنمای عملیات: [RUN.md](RUN.md). قرارداد قیمت: [PRICE-SYNC.md](PRICE-SYNC.md).

## تست و بررسی

```powershell
docker compose exec -T web python manage.py test catalog.tests --noinput
docker compose exec -T web python manage.py check
docker compose exec -T web python manage.py makemigrations --check --dry-run
docker compose exec -T web python manage.py verify_catalog --compare-source /import/catalog.sqlite3
node test_frontend.cjs
```

تست‌های Django روی دیتابیس جداگانه `test_nazdika` هستند؛ داده آزمایشی وارد کاتالوگ اصلی نمی‌شود. دستور `verify_catalog` فقط خواندنی است؛ علاوه بر APIها، می‌تواند تمام رکوردهای خام را با SQLite مقایسه کند. تست رابط به نسخه Docker روی ۸۰۰۰ وصل می‌شود؛ برای آدرس دیگر متغیر `API_BASE` را تعیین کنید. Node فقط برای تست فرانت لازم است، نه اجرای سایت.

## مرز قابلیت‌ها و اعتبار داده

- جست‌وجو، مقایسه، فروشگاه‌ها، ست‌سازی و برنامه خرید فعال‌اند؛ پیشنهادها قاعده‌محورند، نه LLM.
- PostgreSQL از جست‌وجوی متن کامل `simple` و GIN روی متن نرمال‌شده فارسی استفاده می‌کند.
- همه فیلدهای CSV در JSONB `raw` نگهداری می‌شوند؛ قیمت مؤثر و گزارش جدید از اصل داده جداست.
- تمام شماره‌های دیتاست ساختگی‌اند؛ API آن‌ها را علامت می‌زند و تماس با آن‌ها در UI غیرفعال است. وجود سایت/اینستاگرام فقط مبنای تشخیص واقعی‌بودن نام طبق توضیحات چالش است، نه اثبات موجودی.
- دیتاست نمونه انتخابی حدود ۱۰٪ فروشگاه‌ها و حداکثر ۳۰۰ محصول هر فروشگاه است، نه موجودی کامل تهران.
- هیچ فروشنده زنده‌ای متصل نشده؛ endpoint دریافت خوراک آماده است ولی بدون کلید اختصاصی غیرفعال است.
- گزارش دستی، علاقه‌مندی‌ها و برنامه خرید در مرورگرند؛ حساب کاربری مشتری و همگام‌سازی آن‌ها ساخته نشده است.
- پنل مدیریت برای مشاهده رکوردهای واردشده است؛ امکان تغییر/حذف تصادفی آن‌ها ندارد. با `docker compose exec web python manage.py createsuperuser` مدیر بسازید؛ حساب پیش‌فرض وجود ندارد.

## انتشار عمومی

این Compose به localhost متصل است و دیتابیس را روی پورت عمومی منتشر نمی‌کند. برای انتشار، reverse proxy/HTTPS، دامنه و `DJANGO_ALLOWED_HOSTS`، `DJANGO_CSRF_TRUSTED_ORIGINS` و تنظیمات secure cookies را تنظیم کنید. اعتماد به header پراکسی را فقط پشت پراکسیِ مورد اعتماد فعال کنید. Gunicorn سرور اجرایی است؛ `runserver` برای production نیست. Volume ماندگار جای بکاپ مستقل PostgreSQL را نمی‌گیرد. این تغییر به معنای انتشار عمومی انجام‌شده نیست.

فایل‌های `app.js`, `styles.css`, `catalog.css` فقط مرجع نسخه قدیمی‌اند و بارگذاری نمی‌شوند. `server.py` صرفاً ورودی سازگار با Django است، نه سرور SQLite سابق. مستندات قدیمی طراحی، انتخاب فریم‌ورک یا قابلیت فعال را تعیین نمی‌کنند.

فونت وزیرمتن با مجوز OFL است (`assets/OFL.txt`). حقوق استفاده از تصاویر مرجع طراحی پیش از انتشار تجاری باید بررسی شود؛ منابع در `DESIGN-HANDOFF.md` و خروجی طراحی قبلی قابل پیگیری‌اند.

## بررسی‌های ویدئویی

راهنمای قابلیت جدید، تنظیم کلید Supadata و حالت بدون متن در [VIDEO-REVIEWS.md](VIDEO-REVIEWS.md) است. جست‌وجوی خودکار بدون `SUPADATA_API_KEY` فعال نیست؛ این حالت در رابط کاربر صریح نمایش داده می‌شود.

## اصلاح‌های تجربهٔ خرید

تطبیق گزارش مشکلات، اصلاح‌های جست‌وجو/ناوبری/موبایل و محدودیت‌های باقی‌مانده در [UX-CLEANUP.md](UX-CLEANUP.md) ثبت شده‌اند.
