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
    "creator",         # project created_by
    "client",
    "project_manager",
    "consultant",
    "plot_member",     # foreman on any plot under this project
    "none",
]

PlotRoleLabel = Literal[
    "creator",      # project created_by
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
        return "creator"
    if user == getattr(project, "created_by", None):
        return "creator"
    if user == getattr(project, "project_manager", None):
        return "project_manager"
    if user == getattr(project, "client", None):
        return "client"
    if project.consultants.filter(pk=user.pk).exists():
        return "consultant"
    if project.constructionplot_set.filter(
        models.Q(foremen=user)
    ).exists():
        return "plot_member"
    return "none"


def get_plot_role(user, plot) -> PlotRoleLabel:
    """
    Return the most-privileged role the user holds on this plot.
    Priority: owner > project_manager > foreman > client > consultant
    """
    if getattr(user, "is_superuser", False):
        return "creator"
    project = getattr(plot, "construction_project", None)
    if not project:
        return "none"
    if user == getattr(project, "created_by", None):
        return "creator"
    if user == getattr(project, "project_manager", None):
        return "project_manager"
    if plot.foremen.filter(pk=user.pk).exists():
        return "foreman"
    if user == getattr(project, "client", None):
        return "client"
    if project.consultants.filter(pk=user.pk).exists():
        return "consultant"
    return "none"

# Backwards compat alias
get_site_role = get_plot_role