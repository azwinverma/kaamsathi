from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("org/ssf-filings", views.SSFFilingViewSet, basename="org-ssf-filings")
router.register("org/contractors", views.ContractorViewSet, basename="org-contractors")

UUID = r"(?P<pk>[0-9a-fA-F-]{36})"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("org/compliance", views.ComplianceView, "org-compliance"),
    p(rf"org/employments/{UUID}/contract", views.EmploymentContractView, "org-employment-contract"),
    p(
        rf"org/employments/{UUID}/contract\.pdf",
        views.EmploymentContractPdfView,
        "org-employment-contract-pdf",
    ),
    p(
        rf"org/employments/{UUID}/contract/accept",
        views.EmploymentContractOrgAcceptView,
        "org-employment-contract-accept",
    ),
    p(rf"org/payroll-runs/{UUID}/ssf-filing", views.RunSSFFilingView, "org-run-ssf-filing"),
    p(rf"me/employments/{UUID}/contract", views.MeContractView, "me-employment-contract"),
    p(rf"me/employments/{UUID}/contract\.pdf", views.MeContractPdfView, "me-employment-contract-pdf"),
    p(rf"me/employments/{UUID}/contract/accept", views.MeContractAcceptView, "me-employment-contract-accept"),
    *router.urls,
]
