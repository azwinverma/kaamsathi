from django.urls import re_path

from . import flag_views as fv
from . import system_views as v

urlpatterns = [
    # Feature flags (checklist C015 / X012)
    re_path(r"^flags/?$", fv.ClientFlagsView.as_view(), name="flags"),
    re_path(r"^ops/flags/?$", fv.OpsFlagListView.as_view(), name="ops-flags"),
    re_path(
        r"^ops/flags/(?P<key>[a-z0-9_]{2,64})/?$", fv.OpsFlagDetailView.as_view(), name="ops-flag-detail"
    ),
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
