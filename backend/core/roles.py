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
    "storekeeper",
    "consultant",
    "none",
]
 
 
def get_project_role(user, project) -> ProjectRoleLabel:
    """
    Return the most-privileged role the user holds on this project.
    Priority: owner > project_manager > client > consultant > plot_member
    """
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
        construction_project=project
    ).filter(
        models.Q(foreman=user) | models.Q(storekeeper=user)
    ).exists():
        return "plot_member"
    return "none"
 
 
def get_plot_role(user, plot) -> PlotRoleLabel:
    """
    Return the most-privileged role the user holds on this plot.
    Priority: owner > project_manager > foreman > storekeeper > client > consultant
    """
    project = plot.construction_project
    if user == project.created_by:
        return "owner"
    if user == project.client:
        return "client"
    if user == project.project_manager:
        return "project_manager"
    if user == plot.foreman:
        return "foreman"
    if user == plot.storekeeper:
        return "storekeeper"
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
PLOT_READ_ROLES = {"owner", "client", "project_manager", "foreman", "storekeeper", "consultant"}
SITE_READ_ROLES = PLOT_READ_ROLES  # compat alias

#: Roles that may manage a plot
PLOT_MANAGE_ROLES = {"owner", "project_manager", "foreman"}
SITE_MANAGE_ROLES = PLOT_MANAGE_ROLES  # compat alias

#: Roles that may write job reports
REPORT_WRITE_ROLES = {"project_manager", "foreman", "storekeeper"}

#: Roles that may approve/reject reports
REPORT_REVIEW_ROLES = {"owner", "client", "project_manager", "consultant"}

# ---------------------------------------------------------------------------
# Work item permissions
# ---------------------------------------------------------------------------

#: Roles that may create work items (only PM)
WORK_ITEM_CREATE_ROLES = {"project_manager"}

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