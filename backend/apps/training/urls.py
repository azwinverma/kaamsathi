from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("ops/training/providers", views.OpsProviderViewSet, basename="ops-training-providers")
router.register("ops/training/courses", views.OpsCourseViewSet, basename="ops-training-courses")
router.register("ops/training/enrollments", views.OpsEnrollmentViewSet, basename="ops-training-enrollments")


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("me/courses", views.MeCoursesView, "me-courses"),
    p("me/enrollments", views.MeEnrollmentsView, "me-enrollments"),
    p("org/courses", views.OrgCoursesView, "org-courses"),
    p("org/enrollments", views.OrgEnrollmentsView, "org-enrollments"),
    p("ops/training/shortages", views.OpsShortagesView, "ops-training-shortages"),
    *router.urls,
]
