"""
core/api/urls.py
----------------
URL configuration for the construction management API.
 
Hierarchy
---------
/api/
  projects/                                                    ConstructionProjectViewSet
  projects/{project_pk}/
    invite/                                                    ProjectViewSet.invite
    invitations/                                               ProjectViewSet.list_invitations
    plots/                                                     ConstructionPlotViewSet
    plots/{plot_pk}/
      invite/                                                  PlotViewSet.invite
      invitations/                                             PlotViewSet.list_invitations
      workitems/                                               WorkItemViewSet
      workitems/{workitem_pk}/
        jobitems/                                              JobItemViewSet
        jobitems/{jobitem_pk}/
          reports/                                             JobReportViewSet
          reports/{pk}/approve/
          reports/{pk}/reject/
 
  invitations/
    projects/                                                  ProjectInvitationViewSet (list)
    projects/{pk}/accept|decline|revoke/
    plots/                                                     PlotInvitationViewSet (list)
    plots/{pk}/accept|decline|revoke/
 
Install
-------
In your project-level urls.py:
 
    from django.urls import path, include
    urlpatterns = [
        ...
        path("api/", include("core.api.urls")),
    ]
 
Requirements
------------
    pip install djangorestframework-nested
    # or:
    pip install drf-nested-routers
"""
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers
from django.urls import path, include
 
from .views import (
    ConstructionProjectViewSet,
    ConstructionPlotViewSet,
    WorkItemViewSet,
    JobItemViewSet,
    JobReportViewSet,
    ProjectInvitationViewSet,
    PlotInvitationViewSet,
    NotificationViewSet,
)
 
# ---------------------------------------------------------------------------
# Root router
# ---------------------------------------------------------------------------
router = DefaultRouter()
router.register(r"projects", ConstructionProjectViewSet, basename="project")
router.register(r"plots", ConstructionPlotViewSet, basename="plot-flat")
router.register(r"workitems", WorkItemViewSet, basename="workitem-flat")
router.register(r"jobitems", JobItemViewSet, basename="jobitem-flat")
router.register(r"notifications", NotificationViewSet, basename="notification")
 
# ---------------------------------------------------------------------------
# Invitations (flat – user's own inbox/outbox)
# ---------------------------------------------------------------------------
invitation_router = DefaultRouter()
invitation_router.register(
    r"invitations/projects",
    ProjectInvitationViewSet,
    basename="project-invitation",
)
invitation_router.register(
    r"invitations/plots",
    PlotInvitationViewSet,
    basename="plot-invitation",
)
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/plots/
# ---------------------------------------------------------------------------
project_router = nested_routers.NestedDefaultRouter(
    router, r"projects", lookup="project"
)
project_router.register(r"plots", ConstructionPlotViewSet, basename="project-plots")
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/plots/{plot_pk}/workitems/
# ---------------------------------------------------------------------------
plot_router = nested_routers.NestedDefaultRouter(
    project_router, r"plots", lookup="plot"
)
plot_router.register(r"workitems", WorkItemViewSet, basename="plot-workitems")
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/
# ---------------------------------------------------------------------------
workitem_router = nested_routers.NestedDefaultRouter(
    plot_router, r"workitems", lookup="workitem"
)
workitem_router.register(r"jobitems", JobItemViewSet, basename="workitem-jobitems")
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/{jobitem_pk}/reports/
# ---------------------------------------------------------------------------
jobitem_router = nested_routers.NestedDefaultRouter(
    workitem_router, r"jobitems", lookup="jobitem"
)
jobitem_router.register(r"reports", JobReportViewSet, basename="jobitem-reports")
 
# ---------------------------------------------------------------------------
# Final urlpatterns
# ---------------------------------------------------------------------------
urlpatterns = [
    path("", include(router.urls)),
    path("", include(invitation_router.urls)),
    path("", include(project_router.urls)),
    path("", include(plot_router.urls)),
    path("", include(workitem_router.urls)),
    path("", include(jobitem_router.urls)),
]