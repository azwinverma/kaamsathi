from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register(
    "ops/notifications/templates", views.OpsTemplateViewSet, basename="ops-notification-templates"
)

UUID = "[0-9a-f-]{36}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("me/notifications", views.MeNotificationsView, "me-notifications"),
    p("me/notifications/unread-count", views.MeNotificationsUnreadCountView, "me-notifications-unread"),
    p("me/notifications/read-all", views.MeNotificationsReadAllView, "me-notifications-read-all"),
    p(
        rf"me/notifications/(?P<notification_id>{UUID})/read",
        views.MeNotificationReadView,
        "me-notification-read",
    ),
    p("me/devices", views.MeDevicesView, "me-devices"),
    p("me/notification-preferences", views.MeNotificationPreferencesView, "me-notification-preferences"),
    re_path(
        r"^me/devices/(?P<token>[^/]{10,512})/?$", views.MeDeviceDeleteView.as_view(), name="me-device-delete"
    ),
    p("ops/notifications/deliveries", views.OpsDeliveriesView, "ops-notification-deliveries"),
    *router.urls,
]
