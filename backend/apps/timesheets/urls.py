from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("org/timesheets", views.TimesheetViewSet, basename="org-timesheets")


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("org/timesheet-policy", views.TimesheetPolicyView, "org-timesheet-policy"),
    p("me/timesheets", views.MeTimesheetsView, "me-timesheets"),
    *router.urls,
]
