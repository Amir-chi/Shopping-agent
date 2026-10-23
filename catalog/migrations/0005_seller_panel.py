import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('catalog', '0004_inquiry_searchmiss')]

    operations = [
        migrations.AddField(model_name='inquiry', name='seller_unread', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='inquiry', name='updated_at', field=models.DateTimeField(null=True)),
        migrations.CreateModel(
            name='InquiryMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sender', models.CharField(max_length=6)),
                ('text', models.CharField(blank=True, max_length=500)),
                ('available', models.BooleanField(null=True)),
                ('price', models.BigIntegerField(null=True)),
                ('created_at', models.DateTimeField()),
                ('inquiry', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='catalog.inquiry')),
            ],
            options={'ordering': ['created_at', 'id']},
        ),
        migrations.CreateModel(
            name='SellerAccess',
            fields=[
                ('shop', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, serialize=False, to='catalog.shop')),
                ('code_hash', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField()),
            ],
        ),
        migrations.CreateModel(
            name='SellerSession',
            fields=[
                ('token_hash', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('demo', models.BooleanField(default=False)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('shop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='catalog.shop')),
            ],
        ),
    ]
