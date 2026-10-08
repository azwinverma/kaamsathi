"""Billing routes beyond phase-1 ``org/billing/summary`` + ``org/billing/charges`` (in config/api_urls.py)."""

from django.urls import re_path

from . import views

UUID = "[0-9a-f-]{36}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    # employer (owner/admin)
    p("org/billing/subscription", views.OrgSubscriptionView, "org-billing-subscription"),
    p("org/billing/invoices", views.OrgInvoiceListView, "org-billing-invoices"),
    p(rf"org/billing/invoices/(?P<pk>{UUID})", views.OrgInvoiceDetailView, "org-billing-invoice"),
    p(rf"org/billing/invoices/(?P<pk>{UUID})/pdf", views.OrgInvoicePdfView, "org-billing-invoice-pdf"),
    # ops
    p("ops/billing/plans", views.OpsPlansView, "ops-billing-plans"),
    p(r"ops/billing/plans/(?P<code>[a-z_]{1,20})", views.OpsPlanDetailView, "ops-billing-plan"),
    p(
        rf"ops/billing/subscriptions/(?P<org_id>{UUID})",
        views.OpsSubscriptionView,
        "ops-billing-subscription",
    ),
    p("ops/billing/charges", views.OpsChargesView, "ops-billing-charges"),
    p("ops/billing/invoices", views.OpsInvoiceListView, "ops-billing-invoices"),
    p("ops/billing/invoices/generate", views.OpsInvoiceGenerateView, "ops-billing-invoices-generate"),
    p(rf"ops/billing/invoices/(?P<pk>{UUID})", views.OpsInvoiceDetailView, "ops-billing-invoice"),
    p(rf"ops/billing/invoices/(?P<pk>{UUID})/pdf", views.OpsInvoicePdfView, "ops-billing-invoice-pdf"),
    p(rf"ops/billing/invoices/(?P<pk>{UUID})/issue", views.OpsInvoiceIssueView, "ops-billing-invoice-issue"),
    p(rf"ops/billing/invoices/(?P<pk>{UUID})/void", views.OpsInvoiceVoidView, "ops-billing-invoice-void"),
    p(
        rf"ops/billing/invoices/(?P<pk>{UUID})/payments",
        views.OpsInvoicePaymentsView,
        "ops-billing-invoice-payments",
    ),
    p(
        rf"ops/billing/invoices/(?P<pk>{UUID})/credit-notes",
        views.OpsInvoiceCreditNotesView,
        "ops-billing-invoice-credit-notes",
    ),
]
