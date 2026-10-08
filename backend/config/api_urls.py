"""All /api/v1 routes (CONTRACT.md §3). Trailing slashes are optional."""

from django.urls import include, path, re_path

from apps.accounts import views as accounts
from apps.billing import views as billing
from apps.core import views as core
from apps.core.routers import Router
from apps.geo import views as ref
from apps.hiring import views as hiring
from apps.orgs import views as orgs
from apps.payroll import views as payroll
from apps.workers import me_views as me
from apps.workers import ops_views as ops
from apps.workforce import views as workforce

router = Router()
# /org/*
router.register("org/members", orgs.MemberViewSet, basename="org-members")
router.register("org/sites", orgs.SiteViewSet, basename="org-sites")
router.register("org/shifts", orgs.ShiftViewSet, basename="org-shifts")
router.register("org/jobs", hiring.JobViewSet, basename="org-jobs")
router.register("org/applications", hiring.ApplicationViewSet, basename="org-applications")
router.register("org/employments", workforce.EmploymentViewSet, basename="org-employments")
router.register("org/leaves", workforce.LeaveViewSet, basename="org-leaves")
router.register("org/advances", workforce.AdvanceViewSet, basename="org-advances")
router.register("org/holidays", workforce.HolidayViewSet, basename="org-holidays")
router.register("org/payroll-runs", payroll.PayrollRunViewSet, basename="org-payroll-runs")
router.register("org/payslips", payroll.PayslipViewSet, basename="org-payslips")
router.register("org/billing/charges", billing.ChargeViewSet, basename="org-billing-charges")
# /me/*
router.register("me/payslips", me.MePayslipViewSet, basename="me-payslips")
router.register("me/consents", me.MeConsentViewSet, basename="me-consents")
# /ops/*
router.register("ops/workers", ops.OpsWorkerViewSet, basename="ops-workers")
router.register("ops/jobs", ops.OpsJobViewSet, basename="ops-jobs")
router.register("ops/organizations", ops.OpsOrganizationViewSet, basename="ops-organizations")


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("health", ref.HealthView, "health"),
    p("readiness", core.ReadinessView, "readiness"),
    # private documents via short-lived signed tokens (apps.core.files)
    re_path(r"^files/(?P<token>[A-Za-z0-9_\-:.]+)/?$", core.FileDownloadView.as_view(), name="file-download"),
    # reference data
    p("ref/provinces", ref.ProvinceListView, "ref-provinces"),
    p("ref/districts", ref.DistrictListView, "ref-districts"),
    p("ref/trades", ref.TradeListView, "ref-trades"),
    p("ref/minimum-wage", ref.MinimumWageView, "ref-minimum-wage"),
    p("ref/calendar/today", ref.CalendarTodayView, "ref-calendar-today"),
    p("ref/calendar/convert", ref.CalendarConvertView, "ref-calendar-convert"),
    p("ref/calendar/month", ref.CalendarMonthView, "ref-calendar-month"),
    # auth
    p("auth/otp/request", accounts.OTPRequestView, "auth-otp-request"),
    p("auth/otp/verify", accounts.OTPVerifyView, "auth-otp-verify"),
    p("auth/token/refresh", accounts.TokenRefreshView, "auth-token-refresh"),
    p("auth/logout", accounts.LogoutView, "auth-logout"),
    p("auth/me", accounts.MeView, "auth-me"),
    # organizations
    p("orgs", orgs.MyOrganizationsView, "orgs"),
    p("org", orgs.CurrentOrganizationView, "org"),
    p("org/dashboard", orgs.DashboardView, "org-dashboard"),
    p("org/attendance/day", workforce.AttendanceDayView, "org-attendance-day"),
    p("org/attendance/register", workforce.AttendanceRegisterView, "org-attendance-register"),
    p("org/attendance/bulk", workforce.AttendanceBulkView, "org-attendance-bulk"),
    p("org/billing/summary", billing.BillingSummaryView, "org-billing-summary"),
    # worker self-service
    p("me/worker", me.MeWorkerView, "me-worker"),
    p("me/worker/claim", me.MeWorkerClaimView, "me-worker-claim"),
    p("me/employments", me.MeEmploymentsView, "me-employments"),
    p("me/history", me.MeHistoryView, "me-history"),
    p("me/attendance", me.MeAttendanceView, "me-attendance"),
    p("me/attendance/check-in", me.CheckInView, "me-check-in"),
    p("me/attendance/check-out", me.CheckOutView, "me-check-out"),
    # ops
    p("ops/dashboard", ops.OpsDashboardView, "ops-dashboard"),
    *router.urls,
    # Security & platform (docs/CONTRACT-EXTENSIONS.md §1)
    path("", include("apps.accounts.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.core.urls")),
    # Ecosystem apps (docs/CONTRACT-ECOSYSTEM.md) each own their routes.
    path("", include("apps.trust.urls")),
    path("", include("apps.crews.urls")),
    path("", include("apps.credentials.urls")),
    path("", include("apps.training.urls")),
    path("", include("apps.compliance.urls")),
    path("", include("apps.payouts.urls")),
    path("", include("apps.scheduling.urls")),
    path("", include("apps.partners.urls")),
    path("", include("apps.finance.urls")),
    path("", include("apps.insights.urls")),
    path("", include("apps.privacy.urls")),
    path("", include("apps.risk.urls")),
    path("", include("apps.support.urls")),
    path("", include("apps.experience.urls")),
    path("", include("apps.timesheets.urls")),
    path("", include("apps.integrations.urls")),
    path("", include("apps.mobility.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.telemetry.urls")),
    path("", include("apps.billing.urls")),
]
