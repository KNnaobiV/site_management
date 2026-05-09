"""
core/api/permissions.py
-----------------------
All DRF permission classes for the construction management system.
 
Design principle
----------------
Every permission class resolves the project/plot from the view kwargs
and delegates to `get_project_role` / `get_plot_role` from core.roles.
This keeps all role logic in one place.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated
 
from core.roles import (
    get_project_role,
    get_plot_role,
    PROJECT_READ_ROLES,
    PROJECT_MANAGE_ROLES,
    PLOT_READ_ROLES,
    PLOT_MANAGE_ROLES,
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
 
 
def _get_plot(view):
    """Resolve the ConstructionPlot from the view, if available."""
    if hasattr(view, "get_plot"):
        return view.get_plot()
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
# Plot-level permissions
# ---------------------------------------------------------------------------
 
class IsPlotMember(BasePermission):
    """Allow any authenticated user who holds any role on the plot."""
    message = "You are not a member of this plot."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in PLOT_READ_ROLES
 
    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "plot", None) or getattr(
            obj, "construction_plot", None
        )
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in PLOT_READ_ROLES
 

class CanManagePlot(BasePermission):
    """Allow owner, or project manager to write to plot resources."""
    message = "You do not have permission to manage this plot."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in PLOT_MANAGE_ROLES
 
    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "plot", None) or getattr(
            obj, "construction_plot", None
        )
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in PLOT_MANAGE_ROLES
 
 
# Backwards-compat aliases for anything that still imports the old names
IsSiteMember = IsPlotMember
CanManageSite = CanManagePlot


# ---------------------------------------------------------------------------
# Report permissions
# ---------------------------------------------------------------------------
 
class CanSubmitReport(BasePermission):
    """
    Project manager, foremen and storekeepers can create/update reports.
    """
    message = "Only plot staff (foreman/storekeeper) can submit reports."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in REPORT_WRITE_ROLES
 
    def has_object_permission(self, request, view, obj):
        plot = obj.job_item.work_item.construction_plot
        return get_plot_role(request.user, plot) in REPORT_WRITE_ROLES
 
 
class CanReviewReport(BasePermission):
    """Owner, client, PM, and consultants can approve/reject reports."""
    message = "You do not have permission to review reports."
 
    def has_object_permission(self, request, view, obj):
        plot = obj.job_item.work_item.construction_plot
        return get_plot_role(request.user, plot) in REPORT_REVIEW_ROLES
 
 
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
 
 
class CanSendPlotInvitation(BasePermission):
    """Owner, client, or project manager can invite to a plot."""
    message = "Only the project owner, client, or project manager can send plot invitations."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in {"owner", "project_manager"}


# Backwards-compat alias
CanSendSiteInvitation = CanSendPlotInvitation
 
 
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
        if user == obj.invited_by:
            return True
        project = getattr(obj, "project", None)
        if project is None:
            project = obj.plot.construction_project
        return get_project_role(user, project) in {"owner"}