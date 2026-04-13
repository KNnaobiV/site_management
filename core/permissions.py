"""
core/api/permissions.py
-----------------------
All DRF permission classes for the construction management system.
 
Design principle
----------------
Every permission class resolves the project/site from the view kwargs
and delegates to `get_project_role` / `get_site_role` from core.roles.
This keeps all role logic in one place.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated
 
from core.roles import (
    get_project_role,
    get_site_role,
    PROJECT_READ_ROLES,
    PROJECT_MANAGE_ROLES,
    SITE_READ_ROLES,
    SITE_MANAGE_ROLES,
    REPORT_WRITE_ROLES,
    REPORT_REVIEW_ROLES,
)
 
 
# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
 
def _get_project(view):
    """Resolve the ConstructionProject from the view, if available."""
    # ViewSets that are nested under a project expose `project` directly
    if hasattr(view, "get_project"):
        return view.get_project()
    return None
 
 
def _get_site(view):
    """Resolve the ConstructionSite from the view, if available."""
    if hasattr(view, "get_site"):
        return view.get_site()
    return None
 
 
# ---------------------------------------------------------------------------
# Project-level permissions
# ---------------------------------------------------------------------------
 
class IsProjectMember(BasePermission):
    """Allow any authenticated user who holds any role on the project."""
    message = "You are not a member of this project."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        project = _get_project(view)
        if project is None:
            return True  # let object-level check decide
        return get_project_role(request.user, project) in PROJECT_READ_ROLES
 
    def has_object_permission(self, request, view, obj):
        project = getattr(obj, "project", None) or getattr(
            obj, "construction_project", None
        )
        if project is None:
            return False
        return get_project_role(request.user, project) in PROJECT_READ_ROLES
 
 
class CanManageProject(BasePermission):
    """Allow owner, or project manager to write to project resources."""
    message = "You do not have permission to manage this project."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        project = _get_project(view)
        if project is None:
            return True
        return get_project_role(request.user, project) in PROJECT_MANAGE_ROLES
 
    def has_object_permission(self, request, view, obj):
        project = getattr(obj, "project", None) or getattr(
            obj, "construction_project", None
        )
        if project is None:
            return False
        return get_project_role(request.user, project) in PROJECT_MANAGE_ROLES
 
 
class IsProjectOwnerOrCreator(BasePermission):
    """Only the project owner or created_by user."""
    message = "Only the project owner can perform this action."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        project = _get_project(view)
        if project is None:
            return True
        return get_project_role(request.user, project) in {"owner"}
 
    def has_object_permission(self, request, view, obj):
        project = getattr(obj, "project", None) or getattr(
            obj, "construction_project", None
        )
        if project is None:
            return False
        return get_project_role(request.user, project) in {"owner"}
 
 
# ---------------------------------------------------------------------------
# Site-level permissions
# ---------------------------------------------------------------------------
 
class IsSiteMember(BasePermission):
    """Allow any authenticated user who holds any role on the site."""
    message = "You are not a member of this site."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        site = _get_site(view)
        if site is None:
            return True
        return get_site_role(request.user, site) in SITE_READ_ROLES
 
    def has_object_permission(self, request, view, obj):
        site = getattr(obj, "site", None) or getattr(
            obj, "construction_site", None
        )
        if site is None:
            return False
        return get_site_role(request.user, site) in SITE_READ_ROLES
 
 
class CanManageSite(BasePermission):
    """Allow owner, or project manager to write to site resources."""
    message = "You do not have permission to manage this site."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        site = _get_site(view)
        if site is None:
            return True
        return get_site_role(request.user, site) in SITE_MANAGE_ROLES
 
    def has_object_permission(self, request, view, obj):
        site = getattr(obj, "site", None) or getattr(
            obj, "construction_site", None
        )
        if site is None:
            return False
        return get_site_role(request.user, site) in SITE_MANAGE_ROLES
 
 
# ---------------------------------------------------------------------------
# Report permissions
# ---------------------------------------------------------------------------
 
class CanSubmitReport(BasePermission):
    """
    Project manager, foremen and storekeepers can create/update reports.
    """
    message = "Only site staff (foreman/storekeeper) can submit reports."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        site = _get_site(view)
        if site is None:
            return True
        return get_site_role(request.user, site) in REPORT_WRITE_ROLES
 
    def has_object_permission(self, request, view, obj):
        site = getattr(obj.job_item.work_item.construction_site, None, None) \
            or obj.job_item.work_item.construction_site
        return get_site_role(request.user, site) in REPORT_WRITE_ROLES
 
 
class CanReviewReport(BasePermission):
    """Owner, client, PM, and consultants can approve/reject reports."""
    message = "You do not have permission to review reports."
 
    def has_object_permission(self, request, view, obj):
        site = obj.job_item.work_item.construction_site
        return get_site_role(request.user, site) in REPORT_REVIEW_ROLES
 
 
# ---------------------------------------------------------------------------
# Invitation permissions
# ---------------------------------------------------------------------------
 
class CanSendProjectInvitation(BasePermission):
    """Only the project owner or creator can invite to a project."""
    message = "Only the project owner or creator can send project invitations."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        project = _get_project(view)
        if project is None:
            return True
        return get_project_role(request.user, project) in \
            {"owner", "project_manager"}
 
 
class CanSendSiteInvitation(BasePermission):
    """Owner, client, or project manager can invite to a site."""
    message = "Only the project owner, client, or project manager can send site invitations."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        site = _get_site(view)
        if site is None:
            return True
        return get_site_role(request.user, site) in {"owner", "project_manager"}
 
 
class IsInvitee(BasePermission):
    """Only the invitation recipient can accept or decline."""
    message = "Only the invitation recipient can respond to this invitation."
 
    def has_object_permission(self, request, view, obj):
        return obj.invitee == request.user
 
 
class IsInviterOrProjectOwner(BasePermission):
    """The inviter or project owner can revoke an invitation."""
    message = "Only the inviter or project owner can revoke this invitation."
 
    def has_object_permission(self, request, view, obj):
        user = request.user
        # Works for both ProjectInvitation and SiteInvitation
        if user == obj.invited_by:
            return True
        project = getattr(obj, "project", None)
        if project is None:
            project = obj.site.construction_project
        return get_project_role(user, project) in {"owner"}