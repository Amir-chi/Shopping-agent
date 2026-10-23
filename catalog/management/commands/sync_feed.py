import csv
import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from catalog.prices import ingest


class Command(BaseCommand):
    help = 'Import a shop-scoped JSON/CSV observation file; source prices remain archived.'

    def add_arguments(self, parser):
        parser.add_argument('file', type=Path)
        parser.add_argument('--shop-id', required=True)

    def handle(self, *args, **options):
        try:
            with options['file'].open(encoding='utf-8-sig', newline='') as stream:
                if options['file'].suffix.lower() == '.csv':
                    rows = list(csv.DictReader(stream))
                    for row in rows:
                        row['price_toman'] = int(row['price_toman'])
                    payload = {'offers': rows}
                else:
                    payload = json.load(stream)
            self.stdout.write(json.dumps(ingest(options['shop_id'], payload)))
        except (ValueError, OSError, KeyError) as error:
            raise CommandError(str(error)) from error
