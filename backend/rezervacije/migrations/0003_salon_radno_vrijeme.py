from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('rezervacije', '0002_salon_vlasnik'),
    ]

    operations = [
        migrations.AddField(
            model_name='salon',
            name='radno_do',
            field=models.TimeField(default='16:00'),
        ),
        migrations.AddField(
            model_name='salon',
            name='radno_od',
            field=models.TimeField(default='08:00'),
        ),
        migrations.AddField(
            model_name='salon',
            name='trajanje_termina_min',
            field=models.PositiveSmallIntegerField(default=30),
        ),
    ]
