from django.urls import re_path

from . import views


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("org/roster", views.RosterView, "org-roster"),
    p("org/roster/copy-week", views.RosterCopyWeekView, "org-roster-copy-week"),
    p("me/roster", views.MeRosterView, "me-roster"),
]
