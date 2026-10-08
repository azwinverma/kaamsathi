from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("org/api-keys", views.OrgAPIKeyViewSet, basename="org-api-keys")
router.register("org/webhooks", views.WebhookViewSet, basename="org-webhooks")

UUID = "[0-9a-f-]{36}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    # must precede the router so "deliveries" isn't taken as a webhook id
    p(
        rf"org/webhooks/deliveries/(?P<delivery_id>{UUID})/redeliver",
        views.RedeliverView,
        "org-webhook-redeliver",
    ),
    # enterprise API (Authorization: Org ks_org_<prefix>_<secret>)
    p("enterprise/jobs", views.EnterpriseJobsView, "enterprise-jobs"),
    p("enterprise/employments", views.EnterpriseEmploymentsView, "enterprise-employments"),
    p("enterprise/attendance", views.EnterpriseAttendanceView, "enterprise-attendance"),
    p("enterprise/attendance/bulk", views.EnterpriseAttendanceBulkView, "enterprise-attendance-bulk"),
    p("enterprise/payroll-runs", views.EnterprisePayrollRunsView, "enterprise-payroll-runs"),
    p(
        rf"enterprise/payroll-runs/(?P<run_id>{UUID})/payslips",
        views.EnterprisePayslipsView,
        "enterprise-payslips",
    ),
    p("enterprise/timesheets", views.EnterpriseTimesheetsView, "enterprise-timesheets"),
    *router.urls,
]
