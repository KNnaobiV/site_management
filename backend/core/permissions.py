"""
core/api/permissions.py
-----------------------
All DRF permission classes for the construction management system.
 
Design principle
----------------
Every permission class resolves the project/plot from the view kwargs,
request params, or payload and delegates to `get_project_role` / `get_plot_role`
from core.roles. This keeps all role logic in one place.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
from core.models import ConstructionProject, ConstructionPlot
 
from core.roles import (
    get_project_role,
    get_plot_role,
    is_creator_without_pm,
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
    FINANCE_ROLES,
    can_view_finance,
)

 
 
# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
 
def _get_project(view):
    """Resolve the ConstructionProject from the view, query parameters, or request payload, if available."""
    if hasattr(view, "get_project"):
        proj = view.get_project()
        if proj:
            return proj
    request = getattr(view, "request", None)
    if request:
        project_id = None
        if isinstance(request.data, dict):
            project_id = (
                request.data.get("project")
                or request.data.get("project_id")
                or request.data.get("construction_project")
                or request.data.get("construction_project_id")
            )
        if not project_id and request.query_params:
            project_id = (
                request.query_params.get("project")
                or request.query_params.get("project_id")
                or request.query_params.get("construction_project")
                or request.query_params.get("construction_project_id")
            )
        if project_id:
            try:
                return ConstructionProject.objects.filter(pk=project_id).first()
            except Exception:
                pass
    return None
 
 
def _get_plot(view):
    """Resolve the ConstructionPlot from the view, query parameters, or request payload, if available."""
    if hasattr(view, "get_plot"):
        plot = view.get_plot()
        if plot:
            return plot
    if hasattr(view, "get_job_item"):
        job_item = view.get_job_item()
        if job_item and getattr(job_item, "work_item", None):
            return job_item.work_item.construction_plot

    request = getattr(view, "request", None)
    if request:
        plot_id = None
        if isinstance(request.data, dict):
            plot_id = (
                request.data.get("construction_plot")
                or request.data.get("plot")
                or request.data.get("construction_plot_id")
                or request.data.get("plot_id")
            )
            if not plot_id and request.data.get("work_item"):
                from core.models import WorkItem
                try:
                    wi = WorkItem.objects.filter(pk=request.data.get("work_item")).first()
                    if wi:
                        return wi.construction_plot
                except Exception:
                    pass
            if not plot_id and request.data.get("job_item"):
                from core.models import JobItem
                try:
                    ji = JobItem.objects.filter(pk=request.data.get("job_item")).first()
                    if ji and ji.work_item:
                        return ji.work_item.construction_plot
                except Exception:
                    pass

        if not plot_id and request.query_params:
            plot_id = (
                request.query_params.get("construction_plot")
                or request.query_params.get("plot")
                or request.query_params.get("construction_plot_id")
                or request.query_params.get("plot_id")
            )
            if not plot_id and request.query_params.get("work_item"):
                from core.models import WorkItem
                try:
                    wi = WorkItem.objects.filter(pk=request.query_params.get("work_item")).first()
                    if wi:
                        return wi.construction_plot
                except Exception:
                    pass
            if not plot_id and request.query_params.get("job_item"):
                from core.models import JobItem
                try:
                    ji = JobItem.objects.filter(pk=request.query_params.get("job_item")).first()
                    if ji and ji.work_item:
                        return ji.work_item.construction_plot
                except Exception:
                    pass

        if plot_id:
            try:
                return ConstructionPlot.objects.filter(pk=plot_id).first()
            except Exception:
                pass
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
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
    """PM, or creator if no PM, can create work items."""
    message = "You do not have permission to create work items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if is_creator_without_pm(request.user, plot or view):
            return True
        if plot is None:
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in WORK_ITEM_CREATE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if is_creator_without_pm(request.user, plot or obj):
            return True
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in WORK_ITEM_DELETE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in WORK_ITEM_DELETE_ROLES


class CanApproveWorkItem(BasePermission):
    """Only the project manager (or creator if no PM) can approve or reject work items."""
    message = "Only the project manager can approve work items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if is_creator_without_pm(request.user, plot or view):
            return True
        if plot is None:
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in WORK_ITEM_APPROVE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "construction_plot", None)
        if is_creator_without_pm(request.user, plot or obj):
            return True
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in WORK_ITEM_APPROVE_ROLES


# ---------------------------------------------------------------------------
# Job item permissions
# ---------------------------------------------------------------------------

class CanCreateJobItem(BasePermission):
    """PM, or creator if no PM, can create job items."""
    message = "You do not have permission to create job items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if is_creator_without_pm(request.user, plot or view):
            return True
        if plot is None:
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in JOB_ITEM_CREATE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if is_creator_without_pm(request.user, plot or obj):
            return True
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in JOB_ITEM_DELETE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in JOB_ITEM_DELETE_ROLES


class CanApproveJobItem(BasePermission):
    """Only the project manager (or creator if no PM) can approve or reject job items."""
    message = "Only the project manager can approve job items."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if is_creator_without_pm(request.user, plot or view):
            return True
        if plot is None:
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in JOB_ITEM_APPROVE_ROLES

    def has_object_permission(self, request, view, obj):
        plot = getattr(obj, "work_item", None)
        plot = getattr(plot, "construction_plot", None) if plot else None
        if is_creator_without_pm(request.user, plot or obj):
            return True
        if plot is None:
            return False
        return get_plot_role(request.user, plot) in JOB_ITEM_APPROVE_ROLES


# ---------------------------------------------------------------------------
# Report permissions
# ---------------------------------------------------------------------------
 
class CanSubmitReport(BasePermission):
    """
    Project manager, foremen and storekeepers (or creator if no PM) can create/update reports.
    """
    message = "Only plot staff or project manager can submit reports."
 
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        plot = _get_plot(view)
        if is_creator_without_pm(request.user, plot or view):
            return True
        if plot is None:
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in REPORT_WRITE_ROLES
 
    def has_object_permission(self, request, view, obj):
        plot = getattr(getattr(getattr(obj, "job_item", None), "work_item", None), "construction_plot", None)
        if is_creator_without_pm(request.user, plot or obj):
            return True
        if plot is None:
            return False
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
            return request.method in SAFE_METHODS
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
            return request.method in SAFE_METHODS
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
    """Only creator, project manager, and foreman can view and update budgets."""
    message = "You do not have permission to view or manage budgets."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_superuser", False):
            return True
        plot = _get_plot(view)
        if plot:
            return get_plot_role(request.user, plot) in FINANCE_ROLES
        project = _get_project(view)
        if project:
            return can_view_finance(request.user, project)
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, "is_superuser", False):
            return True
        return can_view_finance(request.user, obj)


class CanManageJobFinance(BasePermission):
    """
    Only creator, Project Manager, and Foreman can view or update job budgets.
    """
    message = "You do not have permission to view or manage job budgets."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_superuser", False):
            return True
        plot = _get_plot(view)
        if plot is None:
            return request.method in SAFE_METHODS
        return get_plot_role(request.user, plot) in FINANCE_ROLES

    def has_object_permission(self, request, view, obj):
        if getattr(request.user, "is_superuser", False):
            return True
        plot = obj.job_item.work_item.construction_plot
        return get_plot_role(request.user, plot) in FINANCE_ROLES


class CanManageExpenses(BasePermission):
    """
    Only Project Manager, Creator (owner), and Foreman can view, add, or update expenses.
    Clients, consultants, storekeepers, and outsiders cannot view or manage expenses.
    """
    message = "Only the project manager, creator, or foreman can access expenses."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_superuser", False):
            return True

        plot = _get_plot(view)
        if plot:
            return get_plot_role(request.user, plot) in FINANCE_ROLES

        project = _get_project(view)
        if project:
            return can_view_finance(request.user, project)

        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        # obj is Expense
        if getattr(request.user, "is_superuser", False):
            return True
        return can_view_finance(request.user, obj)




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
            return request.method in SAFE_METHODS
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
