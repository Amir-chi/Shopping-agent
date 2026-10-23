from django.core.management.base import BaseCommand, CommandError

from catalog.models import Shop
from catalog.seller import issue_code


class Command(BaseCommand):
    help = 'Issue a new seller-panel access code for each given shop. Earlier codes and sessions of that shop stop working.'

    def add_arguments(self, parser):
        parser.add_argument('shop_ids', nargs='+')

    def handle(self, *args, **options):
        for shop_id in options['shop_ids']:
            if not Shop.objects.filter(pk=shop_id).exists():
                raise CommandError(f'Unknown shop: {shop_id}')
            self.stdout.write(f'{shop_id}\t{issue_code(shop_id)}')
