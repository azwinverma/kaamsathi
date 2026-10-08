"""Starter help-center articles (apps/support/help_content.py); ops edit them afterwards."""

from django.db import migrations


def forwards(apps, schema_editor):
    from apps.support.help_content import install

    install(apps.get_model("support", "HelpArticle"))


class Migration(migrations.Migration):
    dependencies = [("support", "0002_safety_help_identity")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
