# Hourly wage type (checklist R005): JobOpening/JobOffer wage_type gains "hourly"; offers carry hourly_wage.
# Hand-written so it holds only these operations (other hiring model changes get their own migration).

from django.db import migrations, models


WAGE_TYPES = [("monthly", "Monthly"), ("daily", "Daily"), ("hourly", "Hourly")]


class Migration(migrations.Migration):
    dependencies = [
        ("hiring", "0004_jobalert_joboffer"),
    ]

    operations = [
        migrations.AddField(
            model_name="joboffer",
            name="hourly_wage",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AlterField(
            model_name="joboffer",
            name="wage_type",
            field=models.CharField(choices=WAGE_TYPES, default="monthly", max_length=10),
        ),
        migrations.AlterField(
            model_name="jobopening",
            name="wage_type",
            field=models.CharField(choices=WAGE_TYPES, default="monthly", max_length=10),
        ),
    ]
