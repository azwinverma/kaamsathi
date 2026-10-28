"""Run due scheduled jobs and deferred tasks once (same as POST /api/v1/internal/cron)."""

import json

from django.core.management.base import BaseCommand

from apps.core.cron import run_due


class Command(BaseCommand):
    help = "Run CELERY_BEAT_SCHEDULE entries that are due and deferred tasks (serverless hosting)."

    def add_arguments(self, parser):
        parser.add_argument("--budget", type=float, default=240.0, help="seconds before stopping")

    def handle(self, *args, budget, **options):
        self.stdout.write(json.dumps(run_due(budget_seconds=budget), indent=2))
