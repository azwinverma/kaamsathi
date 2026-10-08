"""Draft monthly invoices from unpaid charges.

``manage.py generate_invoices [--bs-year Y --bs-month M] [--issue]``
"""

from django.core.management.base import BaseCommand, CommandError

from apps.billing import services


class Command(BaseCommand):
    help = "Create draft invoices (one per employer/partner) from unpaid charges up to a BS month."

    def add_arguments(self, parser):
        parser.add_argument("--bs-year", type=int)
        parser.add_argument("--bs-month", type=int)
        parser.add_argument("--issue", action="store_true", help="Also issue (number + PDF) the drafts.")

    def handle(self, *args, bs_year=None, bs_month=None, issue=False, **opts):
        if (bs_year is None) != (bs_month is None):
            raise CommandError("Give both --bs-year and --bs-month, or neither (= previous BS month).")
        if bs_year is None:
            bs_year, bs_month = services.previous_bs_month()
        invoices = services.generate_invoices(bs_year, bs_month)
        for inv in invoices:
            if issue:
                services.issue_invoice(inv)
                inv.refresh_from_db()
            self.stdout.write(f"  {inv.number or 'draft'}  {inv.buyer_name}  Rs. {inv.total}")
        self.stdout.write(self.style.SUCCESS(f"{len(invoices)} invoice(s) for BS {bs_year}-{bs_month:02d}"))
