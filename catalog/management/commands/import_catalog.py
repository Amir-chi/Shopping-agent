"""One atomic, non-destructive import from the old SQLite snapshot or original ZIP."""
import csv
import io
import json
import math
import sqlite3
import zipfile
from contextlib import closing
from itertools import islice
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from catalog.domain import garment_attributes, garment_profile, normalize, parsed, usable_price
from catalog.models import Garment, Metadata, Offer, OfferState, PriceEvent, Product, Shop
from catalog.prices import timestamp


def batches(rows, size=500):
    iterator = iter(rows)
    while batch := list(islice(iterator, size)):
        yield batch


def refresh_aggregates():
    with connection.cursor() as cursor:
        cursor.execute('''UPDATE catalog_product p SET low=a.low,high=a.high,stores=a.stores
            FROM (SELECT product_id,MIN(price) low,MAX(price) high,COUNT(DISTINCT shop_id) stores
                  FROM catalog_offer GROUP BY product_id) a WHERE p.id=a.product_id''')
        cursor.execute("UPDATE catalog_product SET search_document=to_tsvector('simple',search_text)")


class Command(BaseCommand):
    help = 'Import into an empty PostgreSQL catalog. Existing rows are NEVER replaced. SQLite is read-only.'

    def add_arguments(self, parser):
        source = parser.add_mutually_exclusive_group(required=True)
        source.add_argument('--sqlite', type=Path)
        source.add_argument('--zip', type=Path)
        parser.add_argument('--if-empty', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('PostgreSQL is required; there is no SQLite runtime fallback.')
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_xact_lock(hashtext('nazdika.catalog.import'))")
            if not cursor.fetchone()[0]:
                raise CommandError('Another catalog import is running. Retry after it finishes.')
        complete = Metadata.objects.filter(pk='import_complete').first()
        if complete:
            if options['if_empty']:
                self.stdout.write('Catalog already imported; preserving data and merchant history.')
                return
            raise CommandError('Catalog already imported. Refusing to overwrite.')
        if Product.objects.exists() or Shop.objects.exists() or Offer.objects.exists():
            raise CommandError('Catalog is not empty and has no completion marker; investigate before importing.')
        source = options['sqlite'] or options['zip']
        if not source.is_file():
            raise CommandError(f'Import source not found: {source}. Mount data or run import_catalog with --zip.')
        if options['sqlite']:
            wal = Path(str(source) + '-wal')
            if wal.exists() and wal.stat().st_size:
                raise CommandError('SQLite has uncheckpointed WAL data. Supply a checkpointed backup; source is never modified.')
            # immutable avoids creating shm/locks on Docker's read-only Windows bind mount.
            with closing(sqlite3.connect(f'{source.resolve().as_uri()}?mode=ro&immutable=1', uri=True)) as db:
                db.row_factory = sqlite3.Row
                self.import_rows(lambda table: (json.loads(row['raw']) for row in db.execute('SELECT raw FROM ' + table)), db)
        else:
            with zipfile.ZipFile(source) as archive:
                def rows(table):
                    with archive.open('torob-dataset/' + table + '.csv') as stream:
                        yield from csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig', newline=''))
                self.import_rows(rows)
        refresh_aggregates()
        counts = {name: model.objects.count() for name, model in [('products', Product), ('shops', Shop), ('offers', Offer)]}
        Metadata.objects.update_or_create(key='import_complete', defaults={'value': json.dumps(dict(counts=counts, source=source.name))})
        self.stdout.write(self.style.SUCCESS('Imported atomically into PostgreSQL: ' + json.dumps(counts)))

    def import_rows(self, rows, sqlite_db=None):
        for batch in batches(rows('products')):
            products, garments = [], []
            for raw in batch:
                title, category = raw['persian_title'], raw['category_name']
                brand = None if raw['brand_name'] == 'null' else raw['brand_name']
                products.append(Product(id=raw['product_id'], title=title, category=category, brand=brand, raw=raw,
                                        search_text=normalize(' '.join([title, category, brand or '']))))
                slot, _ = garment_profile(category)
                if slot:
                    attrs = garment_attributes(raw)
                    garments.append(Garment(product_id=raw['product_id'], slot=slot, audience=attrs['audience'], color=attrs['color'], attributes=attrs))
            Product.objects.bulk_create(products, batch_size=500)
            Garment.objects.bulk_create(garments, batch_size=500)
        self.stdout.write(f'Products: {Product.objects.count()}')
        for batch in batches(rows('shops')):
            shops = []
            for raw in batch:
                lat, lon = float(raw['lat']), float(raw['lon'])
                if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
                    raise CommandError('Invalid shop coordinates')
                shops.append(Shop(id=raw['shop_id'], name=raw['name'], area=raw['location_label'], lat=lat, lon=lon,
                                  address=raw['address'], categories=parsed(raw.get('category_names'), []), raw=raw,
                                  installment=any(p.get('channel') == 'in_person' for p in parsed(raw.get('payment_options'), []))))
            Shop.objects.bulk_create(shops, batch_size=500)
        self.stdout.write(f'Shops: {Shop.objects.count()}')
        latest = ''
        for batch in batches(rows('offers')):
            offers = []
            for raw in batch:
                changed = raw.get('last_price_changed_at') or ''
                if changed != 'null':
                    latest = max(latest, changed)
                offers.append(Offer(id=raw['offer_id'], product_id=raw['product_id'], shop_id=raw['shop_id'],
                                    price=usable_price(raw['price_toman']), changed=changed, raw=raw))
            Offer.objects.bulk_create(offers, batch_size=500)
        self.stdout.write(f'Offers: {Offer.objects.count()}')
        metadata = {'imported_at': timezone.now().isoformat(), 'snapshot_latest_price': latest, 'garments_version': '1'}
        if sqlite_db:
            tables = {r[0] for r in sqlite_db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if 'metadata' in tables:
                metadata.update(dict(sqlite_db.execute('SELECT key,value FROM metadata')))
            if 'price_events' in tables:
                for batch in batches(sqlite_db.execute('SELECT * FROM price_events')):
                    PriceEvent.objects.bulk_create([PriceEvent(
                        id=r['id'], offer_id=r['offer_id'], shop_id=r['shop_id'], price_toman=r['price_toman'],
                        availability=r['availability'], observed_at=timestamp(r['observed_at']), valid_until=timestamp(r['valid_until']),
                        received_at=timestamp(r['received_at']), product_url=r['product_url']) for r in batch])
            if 'offer_state' in tables:
                for batch in batches(sqlite_db.execute('SELECT * FROM offer_state')):
                    OfferState.objects.bulk_create([OfferState(
                        offer_id=r['offer_id'], price_toman=r['price_toman'], availability=r['availability'],
                        observed_at=timestamp(r['observed_at']), valid_until=timestamp(r['valid_until']), source=r['source'],
                        product_url=r['product_url'], event_id=r['event_id']) for r in batch])
                    for r in batch:
                        Offer.objects.filter(pk=r['offer_id']).update(
                            price=None if r['availability'] == 'out_of_stock' else r['price_toman'])
                # Preserve effective change timestamps as well as archived source timestamps.
                for batch in batches(sqlite_db.execute('SELECT id,changed FROM offers WHERE id IN (SELECT offer_id FROM offer_state)')):
                    Offer.objects.bulk_update([Offer(id=r['id'], changed=r['changed']) for r in batch], ['changed'])
        for key, value in metadata.items():
            if key != 'import_complete':
                Metadata.objects.update_or_create(key=key, defaults={'value': value})
