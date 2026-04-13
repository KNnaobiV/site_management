"""
core/roles.py
-------------
Single source of truth for resolving a user's role on a project or site.
Import `get_project_role` and `get_site_role` everywhere you need to
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
    "site_member",     # foreman/storekeeper on any site under this project
    "none",
]
 
SiteRoleLabel = Literal[
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
    Priority: owner > project_manager > client > consultant > site_member
    """
    if user == project.created_by:
        return "owner"
    if user == project.client:
        return "client"
    if user == project.project_manager:
        return "project_manager"
    if project.consultants.filter(pk=user.pk).exists():
        return "consultant"
    # Check if user is a foreman/storekeeper on any site under this project
    from core.models import ConstructionSite
    if ConstructionSite.objects.filter(
        construction_project=project
    ).filter(
        models.Q(foreman=user) | models.Q(storekeeper=user)
    ).exists():
        return "site_member"
    return "none"
 
 
def get_site_role(user, site) -> SiteRoleLabel:
    """
    Return the most-privileged role the user holds on this site.
    Priority: owner > project_manager > foreman > storekeeper > client > consultant
    """
    project = site.construction_project
    if user == project.created_by:
        return "owner"
    if user == project.client:
        return "client"
    if user == project.project_manager:
        return "project_manager"
    if user == site.foreman:
        return "foreman"
    if user == site.storekeeper:
        return "storekeeper"
    if project.consultants.filter(pk=user.pk).exists():
        return "consultant"
    return "none"
 
 
# ---------------------------------------------------------------------------
# Convenience sets used by permissions
# ---------------------------------------------------------------------------
 
#: Roles that may read a project
PROJECT_READ_ROLES = {"owner", "client", "project_manager", "consultant", "site_member"}
 
#: Roles that may manage (write) a project
PROJECT_MANAGE_ROLES = {"owner", "project_manager"}
 
#: Roles that may read a site
SITE_READ_ROLES = {"owner", "client", "project_manager", "foreman", "storekeeper", "consultant"}
 
#: Roles that may manage a site
SITE_MANAGE_ROLES = {"owner", "project_manager"}
 
#: Roles that may write job reports
REPORT_WRITE_ROLES = {"project_manager", "foreman", "storekeeper"}
 
#: Roles that may approve/reject reports
REPORT_REVIEW_ROLES = {"owner", "client", "project_manager", "consultant"}
 
 