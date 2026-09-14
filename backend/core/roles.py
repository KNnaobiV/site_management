"""
core/roles.py
-------------
Single source of truth for resolving a user's role on a project or plot.
Import `get_project_role` and `get_plot_role` everywhere you need to
make role-based decisions (permissions, serializer field filtering, etc.).
"""
from __future__ import annotations
from typing import Literal

from django.db import models
 
ProjectRoleLabel = Literal[
    "owner",           # created_by
    "client",
    "project_manager",
    "consultant",
    "plot_member",     # foreman/storekeeper on any plot under this project
    "none",
]
 
PlotRoleLabel = Literal[
    "owner",        # project created_by
    "client",       # project client
    "project_manager",
    "foreman",
    "consultant",
    "none",
]
 
 
def get_project_role(user, project) -> ProjectRoleLabel:
    """
    Return the most-privileged role the user holds on this project.
    Priority: owner > project_manager > client > consultant > plot_member
    """
    if getattr(user, "is_superuser", False):
        return "owner"
    if user == project.created_by:
        return "owner"
    if user == project.client:
        return "client"
    if user == project.project_manager:
        return "project_manager"
    if project.consultants.filter(pk=user.pk).exists():
        return "consultant"
    # Check if user is a foreman/storekeeper on any plot under this project
    from core.models import ConstructionPlot
    if ConstructionPlot.objects.filter(
        construction_project=project,
        foremen=user
    ).exists():
        return "plot_member"
    return "none"
 
 
def get_plot_role(user, plot) -> PlotRoleLabel:
    """
    Return the most-privileged role the user holds on this plot.
    Priority: owner > project_manager > foreman > storekeeper > client > consultant
    """
    if getattr(user, "is_superuser", False):
        return "owner"
    project = plot.construction_project
    if user == project.created_by:
        return "owner"
    if user == project.client:
        return "client"
    if user == project.project_manager:
        return "project_manager"
    if plot.foremen.filter(pk=user.pk).exists():
        return "foreman"
    if project.consultants.filter(pk=user.pk).exists():
        return "consultant"
    return "none"


# Backwards compat alias
get_site_role = get_plot_role


def get_project_from_object(obj):
    """Resolve ConstructionProject from any related domain object or return None."""
    if obj is None:
        return None
    if hasattr(obj, "construction_project"):
        return obj.construction_project
    if hasattr(obj, "construction_plot"):
        plot = obj.construction_plot
        return getattr(plot, "construction_project", None) if plot else None
    if hasattr(obj, "work_item"):
        work_item = obj.work_item
        plot = getattr(work_item, "construction_plot", None) if work_item else None
        return getattr(plot, "construction_project", None) if plot else None
    if hasattr(obj, "job_item"):
        job_item = obj.job_item
        work_item = getattr(job_item, "work_item", None) if job_item else None
        plot = getattr(work_item, "construction_plot", None) if work_item else None
        return getattr(plot, "construction_project", None) if plot else None
    if hasattr(obj, "project"):
        return obj.project
    if hasattr(obj, "plot"):
        plot = obj.plot
        return getattr(plot, "construction_project", None) if plot else None
    if hasattr(obj, "created_by") and hasattr(obj, "project_manager"):
        return obj
    return None


def is_creator_without_pm(user, obj_or_view) -> bool:
    """
    Return True if `user` is the creator of the project, and either:
    1. No project manager is assigned (project.project_manager is None), OR
    2. The creator is also the assigned project manager (project.project_manager == user).
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False

    project = None
    if hasattr(obj_or_view, "get_project"):
        project = obj_or_view.get_project()
    elif hasattr(obj_or_view, "get_plot"):
        plot = obj_or_view.get_plot()
        project = getattr(plot, "construction_project", None) if plot else None

    if project is None:
        project = get_project_from_object(obj_or_view)

    if not project or not hasattr(project, "created_by"):
        return False

    if user != project.created_by:
        return False

    return project.project_manager is None or project.project_manager == user

 
 
# ---------------------------------------------------------------------------
# Convenience sets used by permissions
# ---------------------------------------------------------------------------

#: Roles that may read a project
PROJECT_READ_ROLES = {"owner", "client", "project_manager", "consultant", "plot_member"}

#: Roles that may manage (write) a project
PROJECT_MANAGE_ROLES = {"owner", "project_manager"}

#: Roles that may read a plot
PLOT_READ_ROLES = {"owner", "client", "project_manager", "foreman", "consultant"}
SITE_READ_ROLES = PLOT_READ_ROLES  # compat alias

#: Roles that may manage a plot
PLOT_MANAGE_ROLES = {"owner", "project_manager", "foreman"}
SITE_MANAGE_ROLES = PLOT_MANAGE_ROLES  # compat alias

#: Roles that may write job reports
REPORT_WRITE_ROLES = {"project_manager", "foreman"}

#: Roles that may approve/reject reports
REPORT_REVIEW_ROLES = {"owner", "client", "project_manager", "consultant"}

# ---------------------------------------------------------------------------
# Work item permissions
# ---------------------------------------------------------------------------

#: Roles that may create work items
WORK_ITEM_CREATE_ROLES = {"owner", "project_manager"}

#: Roles that may update work item status/progress
WORK_ITEM_UPDATE_ROLES = {"owner", "project_manager", "foreman", "consultant"}

#: Roles that may delete work items
WORK_ITEM_DELETE_ROLES = {"owner", "project_manager"}

#: Only PM can approve or reject work items submitted by the foreman
WORK_ITEM_APPROVE_ROLES = {"project_manager"}

# ---------------------------------------------------------------------------
# Job item permissions
# ---------------------------------------------------------------------------

#: Roles that may create job items (only PM)
JOB_ITEM_CREATE_ROLES = {"project_manager"}

#: Roles that may update job item status/progress
JOB_ITEM_UPDATE_ROLES = {"owner", "project_manager", "foreman", "consultant"}

#: Roles that may delete job items
JOB_ITEM_DELETE_ROLES = {"owner", "project_manager"}

#: Only PM can approve or reject job items submitted by the foreman
JOB_ITEM_APPROVE_ROLES = {"project_manager"}

# ---------------------------------------------------------------------------
# Visibility — which roles see unapproved items
# ---------------------------------------------------------------------------

#: Roles that can see ALL work/job items regardless of approval status
SEES_UNAPPROVED_ROLES = {"owner", "project_manager", "foreman"}

# ---------------------------------------------------------------------------
# Finance permissions (Budgets, Percentage Spend, Expenses)
# ---------------------------------------------------------------------------

#: Roles that may view or manage finance (budgets, percentage spend, expenses)
FINANCE_ROLES = {"owner", "project_manager", "foreman"}


def can_view_finance(user, obj) -> bool:
    """
    Return True if user has permission to view financial details (budget, percentage spend, expenses).
    Strictly limited to:
      1. Superuser
      2. Project creator (owner)
      3. Project Manager (project_manager)
      4. Plot Foreman (on their plot, child work/job items, or any project where they are a foreman)
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True

    from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem

    if isinstance(obj, ConstructionProject):
        if user == obj.created_by or user == obj.project_manager:
            return True
        return obj.constructionplot_set.filter(foremen=user).exists()

    if isinstance(obj, ConstructionPlot):
        if obj.construction_project:
            if user == obj.construction_project.created_by or user == obj.construction_project.project_manager:
                return True
        return obj.foremen.filter(pk=user.pk).exists()

    if isinstance(obj, WorkItem):
        plot = getattr(obj, "construction_plot", None)
        if plot:
            return can_view_finance(user, plot)
        return False

    if isinstance(obj, JobItem):
        work_item = getattr(obj, "work_item", None)
        plot = getattr(work_item, "construction_plot", None) if work_item else None
        if plot:
            return can_view_finance(user, plot)
        return False

    # For Budget / Expense model instances
    if hasattr(obj, "job_item") and obj.job_item:
        return can_view_finance(user, obj.job_item)
    if hasattr(obj, "work_item") and obj.work_item:
        return can_view_finance(user, obj.work_item)
    if hasattr(obj, "plot") and obj.plot:
        return can_view_finance(user, obj.plot)
    if hasattr(obj, "project") and obj.project:
        return can_view_finance(user, obj.project)

    project = get_project_from_object(obj)
    if project:
        return can_view_finance(user, project)

    return False