import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('catalog', '0003_videoreviewcache')]

    operations = [
        migrations.CreateModel(
            name='Inquiry',
            fields=[
                ('id', models.CharField(max_length=32, primary_key=True, serialize=False)),
                ('token_hash', models.CharField(db_index=True, max_length=64)),
                ('questions', models.JSONField(default=list)),
                ('note', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(db_index=True)),
                ('answered_at', models.DateTimeField(null=True)),
                ('available', models.BooleanField(null=True)),
                ('price', models.BigIntegerField(null=True)),
                ('reply', models.CharField(blank=True, max_length=200)),
                ('product', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='catalog.product')),
                ('shop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inquiries', to='catalog.shop')),
            ],
            options={'indexes': [models.Index(fields=['shop', '-created_at'], name='inquiry_shop_recent')]},
        ),
        migrations.CreateModel(
            name='SearchMiss',
            fields=[
                ('query', models.CharField(max_length=80, primary_key=True, serialize=False)),
                ('category', models.TextField(null=True)),
                ('count', models.PositiveIntegerField(default=0)),
                ('last_seen', models.DateTimeField(db_index=True)),
            ],
        ),
    ]
