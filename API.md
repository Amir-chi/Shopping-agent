# سرراه: endpointهای API

پایه: **https://sarrah.liara.run** (همه پاسخ‌ها JSON. موقعیت با `lat`/`lon` ارسال می‌شود و ذخیره نمی‌شود).
مثال‌ها با موقعیت میدان انقلاب: `lat=35.7008&lon=51.4005`.

## تصمیم «همین الان» و موقعیت
| Endpoint | کار | مثال |
|---|---|---|
| `GET /api/now?q&lat&lon[&at=HH:MM&day=mon…sun]` | کدام فروشگاه نزدیک الان باز است، کدام بسته (و کی باز می‌شود)، محدودهٔ پیشنهادی | [/api/now?q=کابل HDMI&at=23:30](https://sarrah.liara.run/api/now?q=%DA%A9%D8%A7%D8%A8%D9%84%20HDMI&lat=35.7008&lon=51.4005&at=23:30) |
| `GET /api/nearby?lat&lon[&ids=product_…]` | فروشگاه‌های تا ۱٫۵ کیلومتری که کالاهای فهرست را دارند | [/api/nearby](https://sarrah.liara.run/api/nearby?lat=35.7008&lon=51.4005) |
| `GET /api/route-plan?ids=a,b&lat&lon` | مسیر خرید یک‌روزه برای چند کالا | |

## جست‌وجو، کالا و فروشگاه
| Endpoint | کار |
|---|---|
| `GET /api/health` | سلامت سرویس |
| `GET /api/bootstrap` | شمارش‌ها، محله‌ها، کالاهای منتخب |
| `GET /api/home` | دپارتمان‌ها و ریل‌های خانه |
| `GET /api/products?q&group&category&max_price&min_price&installment&sort=price\|stores&limit&offset` | جست‌وجو (با تصحیح غلط تایپی: `parsed.corrected`) |
| `GET /api/products/{id}` | جزئیات کالا |
| `GET /api/products/{id}/stores?lat&lon` | فروشگاه‌های این کالا با قیمت، فاصله و ساعت کار |
| `GET /api/products/{id}/bundle` | لوازم مکمل (قاب و محافظ فقط برای همان مدل) |
| `GET /api/products/{id}/price-check[?price=]` | بازهٔ قیمت ثبت‌شده و نظر روی قیمت گفته‌شده |
| `GET /api/products/{id}/web-prices` | قیمت امروز از وب (تأییدنشده، با لینک) |
| `GET /api/shops?q&area&installment` | فهرست فروشگاه‌ها |
| `GET /api/shops/{id}` · `/api/shops/{id}/products` | فروشگاه و ویترینش |
| `GET /api/market-fallback?q` | بورس‌ها و تجمع فروشگاه‌های مرتبط |
| `GET /api/price-status` | وضعیت اتصال قیمت زندهٔ فروشندگان |

## دستیارها (هوش مصنوعی، با سقف درخواست برای هر IP)
| Endpoint | کار |
|---|---|
| `GET /api/assistant?q[&history]` | «کدام مدل بخرم؟»: فیلتر از دیتابیس، رتبه‌بندی با مدل |
| `GET /api/compare-insight?ids=a,b[&need]` | مقایسهٔ ۲–۳ کالا و «کدام برای من» |
| `GET /api/explain-specs?id[&need]` | توضیح مشخصات به زبان ساده |
| `GET /api/gift?relation&interests&budget[&age&for]` | پیشنهاد هدیه |
| `GET /api/dowry[?budget&items&extra]` | برنامهٔ جهیزیه (بدون بودجه: فقط چک‌لیست) |
| `GET /api/outfits[?…&review=1]` | ست لباس |
| `GET /api/video-reviews?id` | بررسی‌های ویدیویی یوتیوب و خلاصهٔ زیرنویس |
| `POST /api/photo-search` `{image}` | تشخیص کالا از عکس |
| `POST /api/color-advice` `{product_id, image}` | رنگ مناسب لوازم خانگی با عکس اتاق |

## پیام به فروشنده و پنل فروشنده
| Endpoint | کار |
|---|---|
| `POST /api/inquiries/new` `{product_id, shop_ids, questions, note}` | استعلام از ۱ تا ۵ فروشگاه (توکن خریدار برمی‌گردد) |
| `GET /api/inquiries?tokens=` · `POST /api/inquiries/reply` | خواندن جواب‌ها و پاسخ خریدار |
| `POST /api/seller/login` | ورود فروشنده (کد، یا ورود نمایشی) |
| `GET/POST /api/seller/{shop}/overview\|conversations\|thread\|products\|reply\|price` | پنل فروشنده (Bearer) |
| `POST /api/merchant-feed/{shop}` | فید قیمت فروشنده (Bearer، قرارداد در PRICE-SYNC.md) |

جزئیات معماری در `CLAUDE.md` و `ARCHITECTURE.md`. اجرای محلی: `docker compose up --build` (README/RUN).
