import json
from django.contrib.postgres.search import SearchVector
from catalog.domain import garment_attributes, garment_profile, normalize
from catalog.models import Garment, Metadata, Offer, Product, Shop


def seed():
    raw_shop = dict(address='تهران، سپهسالار، طبقه اول، واحد ۲', contacts='[{"channel":"phone","display_number":"000"}]',
                    payment_options='[]', weekly_hours='{}', category_names='["کتانی و کفش اسپرت"]',
                    website_url='null', instagram='null', supports_fast_delivery='null')
    for sid, installment in [('shop_one', False), ('shop_two', True), ('shop_empty', False)]:
        Shop.objects.create(id=sid, name=sid, area='تهران', lat=35.7, lon=51.4, installment=installment,
                            address=raw_shop['address'], categories=['کتانی و کفش اسپرت'], raw=raw_shop)
    for pid, title, category, price in [
        ('product_phone', 'گوشی گلکسی A55', 'گوشی موبایل', 1_000_000),
        ('product_laptop', 'لپ تاپ دانشجویی', 'لپ تاپ و نوت بوک', 3_000_000),
        ('product_top', 'پیراهن مردانه مشکی', 'پیراهن مردانه', 200_000),
        ('product_bottom', 'شلوار رسمی مردانه کرم', 'شلوار رسمی و راحتی مردانه', 300_000),
        ('product_shoes', 'کتانی سفید', 'کتانی و کفش اسپرت', 400_000),
    ]:
        raw = dict(product_id=pid, persian_title=title, category_name=category, brand_name='null',
                   model='null', specs='[]', image_urls='[]')
        p = Product.objects.create(id=pid, title=title, category=category, raw=raw, search_text=normalize(title + ' ' + category), low=price, high=price, stores=1)
        slot, _ = garment_profile(category)
        if slot:
            attrs = garment_attributes(raw)
            Garment.objects.create(product=p, slot=slot, audience=attrs['audience'], color=attrs['color'], attributes=attrs)
        offer_raw = dict(offer_id='offer_' + pid.removeprefix('product_'), product_id=pid, shop_id='shop_one',
                         price_toman=str(price), last_price_changed_at='2026-01-01T00:00:00+00:00',
                         seller_title=title, description='', warranty='null')
        Offer.objects.create(id=offer_raw['offer_id'], product=p, shop_id='shop_one', price=price,
                             changed=offer_raw['last_price_changed_at'], raw=offer_raw)
    raw = Offer.objects.get(pk='offer_phone').raw | dict(offer_id='offer_credit', shop_id='shop_two', price_toman='2000000')
    Offer.objects.create(id='offer_credit', product_id='product_phone', shop_id='shop_two', price=2_000_000,
                         changed=raw['last_price_changed_at'], raw=raw)
    Product.objects.filter(pk='product_phone').update(high=2_000_000, stores=2)
    Product.objects.update(search_document=SearchVector('search_text', config='simple'))
    Metadata.objects.create(key='imported_at', value='2026-01-01T00:00:00+00:00')
    Metadata.objects.create(key='import_complete', value=json.dumps({'counts': {'products': 5, 'shops': 3, 'offers': 6}}))
