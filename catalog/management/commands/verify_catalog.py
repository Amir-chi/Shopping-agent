"""Read-only acceptance checks against the actual imported PostgreSQL dataset."""
import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from catalog.models import Metadata, Offer, Product, Shop
from catalog.services import endpoint


def digest(rows):
    # Order-independent multiset digest: sequential scans avoid random I/O on Windows bind mounts.
    total, count = 0, 0
    for raw in rows:
        encoded = json.dumps(raw, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode()
        total = (total + int.from_bytes(hashlib.sha256(encoded).digest(), 'big')) % (1 << 256)
        count += 1
    return hashlib.sha256(f'{count}:{total:064x}'.encode()).hexdigest()


class Command(BaseCommand):
    help = 'Verify counts, aggregates, APIs and optionally EVERY raw record against read-only SQLite.'

    def add_arguments(self, parser):
        parser.add_argument('--compare-source', type=Path)

    def handle(self, *args, **options):
        marker = Metadata.objects.filter(pk='import_complete').first()
        if not marker:
            raise CommandError('No completed import')
        expected = json.loads(marker.value)['counts']
        models = {'products': Product, 'offers': Offer, 'shops': Shop}
        counts = {name: model.objects.count() for name, model in models.items()}
        if counts != expected:
            raise CommandError('Counts differ from the completed import')
        self.stdout.write('Counts match: ' + json.dumps(counts))
        with connection.cursor() as cursor:
            cursor.execute('''SELECT COUNT(*) FROM catalog_product p LEFT JOIN
                (SELECT product_id,MIN(price) low,MAX(price) high,COUNT(DISTINCT shop_id) stores
                 FROM catalog_offer GROUP BY product_id) a ON a.product_id=p.id
                WHERE p.low IS DISTINCT FROM a.low OR p.high IS DISTINCT FROM a.high
                   OR p.stores IS DISTINCT FROM COALESCE(a.stores,0)''')
            if cursor.fetchone()[0]:
                raise CommandError('Cached product prices differ from exact offers')
        for query in ['گوشی تا ۳۰ میلیون', 'گلکسی A55', 'میکروفون', 'لپ‌تاپ دانشجویی', 'کتانی مناسب پیاده‌روی']:
            if not endpoint('/api/products', {'q': query, 'limit': '1'})['items']:
                raise CommandError('Search failed: ' + query)
        first = endpoint('/api/products', {'limit': '1'})['items'][0]
        shops = endpoint('/api/products/' + first['id'] + '/stores', {'lat': '35.7', 'lon': '51.4'})['items']
        if not shops or any(not all(o['product_id'] == first['id'] and o['shop_id'] == s['id'] for o in s['offers']) for s in shops):
            raise CommandError('Broken product/offer/shop relationship')
        for audience in ['men', 'women']:
            if not endpoint('/api/outfits', {'budget': '7000000', 'audience': audience})['items']:
                raise CommandError('Outfit regression: ' + audience)
        if not endpoint('/api/market-fallback', {'q': 'کفش'})['items']:
            raise CommandError('Market fallback regression')
        self.stdout.write('PostgreSQL aggregates, Persian search, exact offers, outfits and markets: OK')
        if source := options['compare_source']:
            if not source.is_file() or (Path(str(source) + '-wal').exists() and Path(str(source) + '-wal').stat().st_size):
                raise CommandError('Supply an existing checkpointed SQLite backup')
            with closing(sqlite3.connect(f'{source.resolve().as_uri()}?mode=ro&immutable=1', uri=True)) as db:
                for table, model in models.items():
                    original = digest(json.loads(row[0]) for row in db.execute('SELECT raw FROM ' + table))
                    imported = digest(model.objects.order_by().values_list('raw', flat=True).iterator(chunk_size=500))
                    if original != imported:
                        raise CommandError('Raw data mismatch: ' + table)
                    self.stdout.write(f'Every raw record preserved: {table} ({original[:12]})')
