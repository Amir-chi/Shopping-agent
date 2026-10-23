from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('catalog', '0002_rebuild_garments')]
    operations = [migrations.CreateModel(
        name='VideoReviewCache',
        fields=[
            ('key', models.CharField(max_length=64, primary_key=True, serialize=False)),
            ('payload', models.JSONField(default=dict)),
            ('expires_at', models.DateTimeField(db_index=True)),
            ('locked_until', models.DateTimeField(null=True)),
        ],
    )]
