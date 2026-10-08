from django.urls import re_path

from . import system_views as v

urlpatterns = [
    re_path(r"^metrics/?$", v.MetricsView.as_view(), name="metrics"),
    re_path(r"^ops/system/health/?$", v.SystemHealthView.as_view(), name="ops-system-health"),
    re_path(r"^ops/system/failed-tasks/?$", v.FailedTaskListView.as_view(), name="ops-system-failed-tasks"),
    re_path(
        r"^ops/system/failed-tasks/(?P<pk>[0-9a-f-]{36})/retry/?$",
        v.FailedTaskRetryView.as_view(),
        name="ops-system-failed-task-retry",
    ),
    re_path(
        r"^ops/system/failed-tasks/(?P<pk>[0-9a-f-]{36})/dismiss/?$",
        v.FailedTaskDismissView.as_view(),
        name="ops-system-failed-task-dismiss",
    ),
]
