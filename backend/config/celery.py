import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# ReliableTask (apps/core/tasks.py): backoff retries, acks_late, FailedTask capture, metrics.
app = Celery("kaamsathi", task_cls="apps.core.tasks:ReliableTask")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
