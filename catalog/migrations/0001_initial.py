import django.contrib.postgres.indexes
import django.contrib.postgres.search
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.CharField(max_length=80, primary_key=True, serialize=False)),
                ('title', models.TextField()),
                ('category', models.TextField(db_index=True)),
                ('brand', models.TextField(blank=True, null=True)),
                ('raw', models.JSONField()),
                ('search_text', models.TextField(blank=True)),
                ('search_document', django.contrib.postgres.search.SearchVectorField(null=True)),
                ('low', models.BigIntegerField(null=True)),
                ('high', models.BigIntegerField(null=True)),
                ('stores', models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name='Metadata',
            fields=[
                ('key', models.CharField(max_length=80, primary_key=True, serialize=False)),
                ('value', models.TextField()),
            ],
        ),
        migrations.CreateModel(
            name='Offer',
            fields=[
                ('id', models.CharField(max_length=80, primary_key=True, serialize=False)),
                ('price', models.BigIntegerField(null=True)),
                ('changed', models.TextField(blank=True)),
                ('raw', models.JSONField()),
            ],
        ),
        migrations.CreateModel(
            name='PriceEvent',
            fields=[
                ('id', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('price_toman', models.BigIntegerField()),
                ('availability', models.CharField(max_length=16)),
                ('observed_at', models.DateTimeField()),
                ('valid_until', models.DateTimeField()),
                ('received_at', models.DateTimeField()),
                ('product_url', models.URLField(blank=True, max_length=2000, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Shop',
            fields=[
                ('id', models.CharField(max_length=80, primary_key=True, serialize=False)),
                ('name', models.TextField()),
                ('area', models.TextField(db_index=True)),
                ('lat', models.FloatField()),
                ('lon', models.FloatField()),
                ('installment', models.BooleanField(default=False)),
                ('address', models.TextField(blank=True)),
                ('categories', models.JSONField(default=list)),
                ('raw', models.JSONField()),
            ],
        ),
        migrations.CreateModel(
            name='Garment',
            fields=[
                ('product', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name='garment', serialize=False, to='catalog.product')),
                ('slot', models.CharField(max_length=12)),
                ('audience', models.CharField(max_length=12)),
                ('color', models.TextField(null=True)),
                ('attributes', models.JSONField()),
            ],
        ),
        migrations.AddIndex(
            model_name='product',
            index=django.contrib.postgres.indexes.GinIndex(fields=['search_document'], name='product_search_gin'),
        ),
        migrations.CreateModel(
            name='OfferState',
            fields=[
                ('offer', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name='state', serialize=False, to='catalog.offer')),
                ('price_toman', models.BigIntegerField()),
                ('availability', models.CharField(max_length=16)),
                ('observed_at', models.DateTimeField()),
                ('valid_until', models.DateTimeField()),
                ('source', models.CharField(default='merchant_feed', max_length=24)),
                ('product_url', models.URLField(blank=True, max_length=2000, null=True)),
                ('event_id', models.CharField(max_length=64)),
            ],
        ),
        migrations.AddField(
            model_name='offer',
            name='product',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='offers', to='catalog.product'),
        ),
        migrations.AddField(
            model_name='priceevent',
            name='offer',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='events', to='catalog.offer'),
        ),
        migrations.AddIndex(
            model_name='shop',
            index=django.contrib.postgres.indexes.GinIndex(fields=['categories'], name='shop_categories_gin'),
        ),
        migrations.AddField(
            model_name='priceevent',
            name='shop',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='catalog.shop'),
        ),
        migrations.AddField(
            model_name='offer',
            name='shop',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='offers', to='catalog.shop'),
        ),
        migrations.AddIndex(
            model_name='garment',
            index=models.Index(fields=['slot', 'audience'], name='garment_slot_audience'),
        ),
        migrations.AddIndex(
            model_name='priceevent',
            index=models.Index(fields=['offer', '-observed_at'], name='price_event_history'),
        ),
        migrations.AddIndex(
            model_name='offer',
            index=models.Index(fields=['product', 'price'], name='offer_product_price'),
        ),
        migrations.AddIndex(
            model_name='offer',
            index=models.Index(fields=['shop', 'product'], name='offer_shop_product'),
        ),
    ]
