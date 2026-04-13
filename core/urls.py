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
    sites/                                                     ConstructionSiteViewSet
    sites/{site_pk}/
      invite/                                                  SiteViewSet.invite
      invitations/                                             SiteViewSet.list_invitations
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
    sites/                                                     SiteInvitationViewSet (list)
    sites/{pk}/accept|decline|revoke/
 
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
    ConstructionSiteViewSet,
    WorkItemViewSet,
    JobItemViewSet,
    JobReportViewSet,
    ProjectInvitationViewSet,
    SiteInvitationViewSet,
)
 
# ---------------------------------------------------------------------------
# Root router
# ---------------------------------------------------------------------------
router = DefaultRouter()
router.register(r"projects", ConstructionProjectViewSet, basename="project")
 
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
    r"invitations/sites",
    SiteInvitationViewSet,
    basename="site-invitation",
)
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/sites/
# ---------------------------------------------------------------------------
project_router = nested_routers.NestedDefaultRouter(
    router, r"projects", lookup="project"
)
project_router.register(r"sites", ConstructionSiteViewSet, basename="project-sites")
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/sites/{site_pk}/workitems/
# ---------------------------------------------------------------------------
site_router = nested_routers.NestedDefaultRouter(
    project_router, r"sites", lookup="site"
)
site_router.register(r"workitems", WorkItemViewSet, basename="site-workitems")
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/sites/{site_pk}/workitems/{workitem_pk}/jobitems/
# ---------------------------------------------------------------------------
workitem_router = nested_routers.NestedDefaultRouter(
    site_router, r"workitems", lookup="workitem"
)
workitem_router.register(r"jobitems", JobItemViewSet, basename="workitem-jobitems")
 
# ---------------------------------------------------------------------------
# /projects/{project_pk}/sites/{site_pk}/workitems/{workitem_pk}/jobitems/{jobitem_pk}/reports/
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
    path("", include(site_router.urls)),
    path("", include(workitem_router.urls)),
    path("", include(jobitem_router.urls)),
]