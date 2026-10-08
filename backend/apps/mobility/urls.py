from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()

UUID = "[0-9a-f-]{36}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("me/mobility/documents", views.MeDocumentsView, "me-mobility-documents"),
    p(rf"me/mobility/documents/(?P<doc_id>{UUID})", views.MeDocumentDetailView, "me-mobility-document"),
    p("me/mobility/agencies", views.MeAgenciesView, "me-mobility-agencies"),
    p("me/mobility/shares", views.MeSharesView, "me-mobility-shares"),
    p("ops/mobility/documents", views.OpsDocumentsView, "ops-mobility-documents"),
    p(
        rf"ops/mobility/documents/(?P<doc_id>{UUID})/verify",
        views.OpsDocumentVerifyView,
        "ops-mobility-document-verify",
    ),
    p("ops/mobility/agencies", views.OpsAgenciesView, "ops-mobility-agencies"),
    p(
        rf"ops/mobility/agencies/(?P<partner_id>{UUID})/compliance",
        views.OpsAgencyComplianceView,
        "ops-mobility-agency-compliance",
    ),
    *router.urls,
]
