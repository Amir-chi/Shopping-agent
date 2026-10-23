import csv
import io
import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from catalog.models import Offer, OfferState, PriceEvent, Product, Shop


def source_rows():
    return {
        'products': [dict(product_id='product_import', persian_title='گوشی آزمایشی', category_name='گوشی موبایل',
                          brand_name='null', model='null', image_urls='[]', specs='[]')],
        'shops': [dict(shop_id='shop_import', name='نام دیتاست', location_label='تهران', lat='35.7', lon='51.4',
                       address='پاساژ، واحد ۲', category_names='[]', payment_options='[]', weekly_hours='{}',
                       contacts='[]', website_url='null', instagram='null', supports_fast_delivery='null')],
        'offers': [dict(offer_id='offer_import', product_id='product_import', shop_id='shop_import', price_toman='100000',
                        last_price_changed_at='2026-01-01T00:00:00+00:00', seller_title='عنوان فروشنده',
                        warranty='null', description='متن کامل با حفظ همه فیلدها')],
    }


def sqlite_source(path, rows):
    with sqlite3.connect(path) as db:
        for table in ['products', 'shops', 'offers']:
            db.execute('CREATE TABLE ' + table + '(id TEXT PRIMARY KEY,raw TEXT,changed TEXT)')
            for index, raw in enumerate(rows[table]):
                key = raw[{'products': 'product_id', 'shops': 'shop_id', 'offers': 'offer_id'}[table]]
                db.execute('INSERT INTO ' + table + ' VALUES(?,?,?)', (key, json.dumps(raw), raw.get('last_price_changed_at', '')))


class ImportTests(TestCase):
    def test_sqlite_read_only_preserves_every_field_and_is_idempotent(self):
        rows = source_rows()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.sqlite3'
            sqlite_source(path, rows)
            before = path.read_bytes()
            call_command('import_catalog', sqlite=path, stdout=io.StringIO())
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(Product.objects.get().raw, rows['products'][0])
            self.assertEqual(Shop.objects.get().raw, rows['shops'][0])
            self.assertEqual(Offer.objects.get().raw, rows['offers'][0])
            self.assertEqual(Product.objects.get().low, 100000)
            Offer.objects.update(price=123000)
            call_command('import_catalog', sqlite=path, if_empty=True, stdout=io.StringIO())
            self.assertEqual(Offer.objects.get().price, 123000)
            with self.assertRaises(CommandError):
                call_command('import_catalog', sqlite=path, stdout=io.StringIO())

    def test_zip_import(self):
        rows = source_rows()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                for table, records in rows.items():
                    content = io.StringIO()
                    writer = csv.DictWriter(content, fieldnames=list(records[0]))
                    writer.writeheader()
                    writer.writerows(records)
                    archive.writestr('torob-dataset/' + table + '.csv', content.getvalue())
            call_command('import_catalog', zip=path, stdout=io.StringIO())
            self.assertEqual(Product.objects.count(), 1)
            self.assertEqual(Offer.objects.get().raw, rows['offers'][0])

    def test_existing_merchant_observation_and_history_are_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.sqlite3'
            sqlite_source(path, source_rows())
            with sqlite3.connect(path) as db:
                db.execute('''CREATE TABLE offer_state(offer_id TEXT,price_toman INTEGER,availability TEXT,
                    observed_at TEXT,valid_until TEXT,source TEXT,product_url TEXT,event_id TEXT)''')
                db.execute('''CREATE TABLE price_events(id TEXT,offer_id TEXT,shop_id TEXT,price_toman INTEGER,
                    availability TEXT,observed_at TEXT,valid_until TEXT,received_at TEXT,product_url TEXT)''')
                values = ('offer_import', 175000, 'in_stock', '2026-02-01T00:00:00+00:00', '2026-02-01T06:00:00+00:00')
                db.execute('INSERT INTO offer_state VALUES(?,?,?,?,?,?,?,?)', values + ('merchant_feed', None, 'a' * 64))
                db.execute('INSERT INTO price_events VALUES(?,?,?,?,?,?,?,?,?)', ('a' * 64, 'offer_import', 'shop_import', 175000,
                           'in_stock', values[3], values[4], values[3], None))
                db.execute('UPDATE offers SET changed=?', (values[3],))
            call_command('import_catalog', sqlite=path, stdout=io.StringIO())
            self.assertEqual(Offer.objects.get().price, 175000)
            self.assertEqual(Offer.objects.get().raw['price_toman'], '100000')
            self.assertEqual(Offer.objects.get().changed, values[3])
            self.assertEqual(Product.objects.get().low, 175000)
            self.assertEqual(OfferState.objects.count(), 1)
            self.assertEqual(PriceEvent.objects.count(), 1)

    def test_invalid_source_rolls_back_all_tables(self):
        rows = source_rows()
        rows['shops'][0]['lat'] = 'nan'
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.sqlite3'
            sqlite_source(path, rows)
            with self.assertRaises(CommandError):
                call_command('import_catalog', sqlite=path, stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(Shop.objects.count(), 0)

    def test_nonempty_wal_is_rejected_without_touching_source(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'source.sqlite3'
            sqlite_source(path, source_rows())
            Path(str(path) + '-wal').write_bytes(b'not-a-checkpointed-snapshot')
            with self.assertRaises(CommandError):
                call_command('import_catalog', sqlite=path, stdout=io.StringIO())
            self.assertFalse(Product.objects.exists())
