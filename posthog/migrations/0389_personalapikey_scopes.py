# Generated by Django 3.2.23 on 2024-02-05 17:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posthog', '0388_add_schema_to_batch_exports'),
    ]

    operations = [
        migrations.AddField(
            model_name='personalapikey',
            name='scopes',
            field=models.CharField(blank=True, max_length=1000, null=True, unique=True),
        ),
    ]
