from django.db import migrations


def seed(apps, schema_editor):
    from apps.notifications.defaults import iter_defaults

    Template = apps.get_model("notifications", "NotificationTemplate")
    for key, channel, language, subject, body in iter_defaults():
        if not Template.objects.filter(key=key, channel=channel, language=language).exists():
            Template.objects.create(
                key=key, channel=channel, language=language, version=1, subject=subject, body=body
            )


class Migration(migrations.Migration):
    dependencies = [("notifications", "0003_templates_deliveries_preferences")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
