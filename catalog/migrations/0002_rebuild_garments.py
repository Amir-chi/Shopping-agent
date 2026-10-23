"""Outfit pieces now include outerwear, boots, skirts and accessories; rebuild the derived Garment rows."""
from django.db import migrations


def rebuild(apps, schema_editor):
    from catalog.domain import GARMENTS, garment_attributes, garment_profile
    Garment, Product = apps.get_model('catalog', 'Garment'), apps.get_model('catalog', 'Product')
    Garment.objects.all().delete()
    categories = [c for members in GARMENTS.values() for c in members]
    rows = []
    for product in Product.objects.filter(category__in=categories).only('pk', 'category', 'raw').iterator(chunk_size=1000):
        slot, _ = garment_profile(product.category)
        attrs = garment_attributes(product.raw)
        rows.append(Garment(product_id=product.pk, slot=slot, audience=attrs['audience'], color=attrs['color'], attributes=attrs))
    Garment.objects.bulk_create(rows, batch_size=1000)


class Migration(migrations.Migration):
    dependencies = [('catalog', '0001_initial')]
    operations = [migrations.RunPython(rebuild, migrations.RunPython.noop)]
