from django.core.management.base import BaseCommand

from apps.core.maintenance import MODES, current_mode, set_mode


class Command(BaseCommand):
    help = "Show or set maintenance mode: off | read_only | full (takes effect on all workers at once)."

    def add_arguments(self, parser):
        parser.add_argument("mode", nargs="?", choices=MODES)

    def handle(self, *args, mode=None, **options):
        if mode:
            set_mode(mode)
            from apps.audit.models import AuditLog

            AuditLog.objects.create(action="system.maintenance", object_type="system", changes={"mode": mode})
        self.stdout.write(f"maintenance mode: {current_mode()}")
