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