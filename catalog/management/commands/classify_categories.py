"""Assign every leaf category to a department with Luna; already-mapped leaves are kept."""
import json

from django.core.management.base import BaseCommand, CommandError

from catalog import ai
from catalog.models import Product
from catalog.taxonomy import GROUPS, GROUP_IDS, PATH, mapping

SYSTEM = ('You classify Persian e-commerce leaf categories (Torob, Iran) into exactly one shopping department. '
          'Departments: ' + '; '.join(f'{gid} = {name}' for gid, name, _ in GROUPS) + '. '
          'Rules: phone/tablet parts and accessories (cases, screen protectors, LCDs, chargers for phones) -> mobile; '
          'computers, laptops, audio, cameras, CCTV, networking, gaming, smart watches -> digital; '
          'building wiring, switches, sockets, fuses, contactors, relays, panels -> electrical; '
          'pumps, generators, motors, pneumatics, inverters, automation, hand/power tools -> industrial; '
          'clothes, shoes, bags, watches, sunglasses, jewelry -> fashion; surgical/medical/lab -> health. '
          'Return JSON {"map": {"<leaf exactly as given>": "<department id>"}} covering every leaf.')


class Command(BaseCommand):
    help = 'Classify unmapped leaf categories into departments (writes catalog/taxonomy.json).'

    def add_arguments(self, parser):
        parser.add_argument('--batch', type=int, default=250)

    def handle(self, *args, **options):
        result = dict(mapping())
        todo = sorted(set(Product.objects.values_list('category', flat=True).distinct()) - set(result))
        self.stdout.write(f'{len(result)} mapped, {len(todo)} to classify')
        for start in range(0, len(todo), options['batch']):
            batch = todo[start:start + options['batch']]
            for attempt in range(3):
                try:
                    answer = ai.chat_json(SYSTEM, json.dumps(batch, ensure_ascii=False), timeout=180).get('map', {})
                    break
                except ai.Unavailable as error:
                    if attempt == 2:
                        raise CommandError(str(error)) from error
            for leaf in batch:
                result[leaf] = answer.get(leaf) if answer.get(leaf) in GROUP_IDS else 'other'
            PATH.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False, indent=0), encoding='utf-8')
            self.stdout.write(f'{min(start + len(batch), len(todo))}/{len(todo)}')
        counts = {g: list(result.values()).count(g) for g in GROUP_IDS}
        self.stdout.write(json.dumps(counts, ensure_ascii=False))
