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
from core.models import ConstructionProject, ConstructionPlot
 
from core.roles import (
    get_project_role,
    get_plot_role,
    PROJECT_READ_ROLES,
    PROJECT_MANAGE_ROLES,
    PLOT_READ_ROLES,
    PLOT_MANAGE_ROLES,
    REPORT_WRITE_ROLES,
    REPORT_REVIEW_ROLES,
    WORK_ITEM_CREATE_ROLES,
    WORK_ITEM_UPDATE_ROLES,
    WORK_ITEM_DELETE_ROLES,
    WORK_ITEM_APPROVE_ROLES,
    JOB_ITEM_CREATE_ROLES,
    JOB_ITEM_UPDATE_ROLES,
    JOB_ITEM_DELETE_ROLES,
    JOB_ITEM_APPROVE_ROLES,
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
        if isinstance(obj, ConstructionProject):
            project = obj
        else:
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
        if isinstance(obj, ConstructionProject):
            project = obj
        else:
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
        if isinstance(obj, ConstructionProject):
            project = obj
        else:
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
        if isinstance(obj, ConstructionPlot):
            plot = obj
        elif hasattr(obj, "construction_plot"):
            plot = obj.construction_plot
        elif hasattr(obj, "work_item"):
            plot = obj.work_item.construction_plot
        elif hasattr(obj, "job_item"):
            plot = obj.job_item.work_item.construction_plot
        else:
            plot = getattr(obj, "plot", None)
            
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
        if isinstance(obj, ConstructionPlot):
            plot = obj
        elif hasattr(obj, "construction_plot"):
            plot = obj.construction_plot
        elif hasattr(obj, "work_item"):
            plot = obj.work_item.construction_plot
        elif hasattr(obj, "job_item"):
            plot = obj.job_item.work_item.construction_plot
        else:
            plot = getattr(obj, "plot", None)
            
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in PLOT_MANAGE_ROLES
 
 
# Backwards-compat aliases for anything that still imports the old names
IsSiteMember = IsPlotMember
CanManageSite = CanManagePlot


# ---------------------------------------------------------------------------
# Work item permissions
# ---------------------------------------------------------------------------

class CanCreateWorkItem(BasePermission):
    """PM, owner, and foreman can create work items."""
    message = "You do not have permission to create work items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in WORK_ITEM_CREATE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in WORK_ITEM_CREATE_ROLES


class CanUpdateWorkItem(BasePermission):
    """PM, owner, and foreman can update work items (status, progress)."""
    message = "You do not have permission to update work items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in WORK_ITEM_UPDATE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in WORK_ITEM_UPDATE_ROLES


class CanDeleteWorkItem(BasePermission):
    """Only PM and owner can delete work items."""
    message = "Only the project manager or owner can delete work items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in WORK_ITEM_DELETE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in WORK_ITEM_DELETE_ROLES


class CanApproveWorkItem(BasePermission):
    """Only the project manager can approve or reject work items."""
    message = "Only the project manager can approve work items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in WORK_ITEM_APPROVE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in WORK_ITEM_APPROVE_ROLES


# ---------------------------------------------------------------------------
# Job item permissions
# ---------------------------------------------------------------------------

class CanCreateJobItem(BasePermission):
    """PM, owner, and foreman can create job items."""
    message = "You do not have permission to create job items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in JOB_ITEM_CREATE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in JOB_ITEM_CREATE_ROLES


class CanUpdateJobItem(BasePermission):
    """PM, owner, and foreman can update job item status/progress."""
    message = "You do not have permission to update job items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in JOB_ITEM_UPDATE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in JOB_ITEM_UPDATE_ROLES


class CanDeleteJobItem(BasePermission):
    """Only PM and owner can delete job items."""
    message = "Only the project manager or owner can delete job items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in JOB_ITEM_DELETE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in JOB_ITEM_DELETE_ROLES


class CanApproveJobItem(BasePermission):
    """Only the project manager can approve or reject job items."""
    message = "Only the project manager can approve job items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in JOB_ITEM_APPROVE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in JOB_ITEM_APPROVE_ROLES


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
    """Owner or project manager can invite to a plot."""
    message = "Only the project owner or project manager can send plot invitations."
 
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


# ---------------------------------------------------------------------------
# Finance permissions
# ---------------------------------------------------------------------------

class CanManageFinance(BasePermission):
    """Only project manager (and owner) can view and update overall finance/budgets."""
    message = "You do not have permission to view or manage budgets."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in {"owner", "project_manager"}

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "plot"):
            plot = obj.plot
        elif hasattr(obj, "work_item"):
            plot = obj.work_item.construction_plot
        else:
            return False
        return get_plot_role(request.user, plot) in {"owner", "project_manager"}


class CanManageJobFinance(BasePermission):
    """
    Project Manager and Foreman can view job budgets.
    Only Project Manager can update job budgets.
    """
    message = "You do not have permission to view or manage job budgets."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        role = get_plot_role(request.user, plot)
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return role in {"owner", "project_manager", "foreman"}
        return role in {"owner", "project_manager"}

    def has_object_permission(self, request, view, obj):
        # obj is JobItemBudget
        plot = obj.job_item.work_item.construction_plot
        role = get_plot_role(request.user, plot)
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return role in {"owner", "project_manager", "foreman"}
        return role in {"owner", "project_manager"}


class CanManageExpenses(BasePermission):
    """Project Manager and Foreman can view, create, and update expenses."""
    message = "You do not have permission to manage expenses."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if plot is None:
            return True
        return get_plot_role(request.user, plot) in {"owner", "project_manager", "foreman"}

    def has_object_permission(self, request, view, obj):
        # obj is Expense
        plot = obj.job_item.work_item.construction_plot
        return get_plot_role(request.user, plot) in {"owner", "project_manager", "foreman"}


# ---------------------------------------------------------------------------
# Document permissions
# ---------------------------------------------------------------------------

class CanManageDocuments(BasePermission):
    """Only project manager and consultants can create/update documents."""
    message = "Only the project manager or consultants can manage documents."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        project = _get_project(view)
        if project is None:
            # If not a project view, allow the object-level permission to decide
            return True
        return get_project_role(request.user, project) in {"owner", "project_manager", "consultant"}

    def has_object_permission(self, request, view, obj):
        if view.action == "destroy" and request.user != obj.uploaded_by:
            return False
            
        project = getattr(obj, "project", None)
        if project is None and getattr(obj, "plot", None):
            project = obj.plot.construction_project
        if project is None:
            return False
        return get_project_role(request.user, project) in {"owner", "project_manager", "consultant"}
