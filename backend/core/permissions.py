"""
core/api/permissions.py
-----------------------
All DRF permission classes for the construction management system.

These delegate all their logic to AuthorizationService.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from core.services.authorization import AuthorizationService
from core.selectors.scope import get_scope


class BaseRolePermission(BasePermission):
    """Base class that provides an AuthorizationService instance."""
    def get_auth_service(self, request):
        return AuthorizationService(request.user)

    def get_scope_obj(self, view):
        if hasattr(view, "get_scope_object"):
            obj = view.get_scope_object()
            if obj: return obj
            
        if hasattr(view, "get_project"):
            try:
                proj = view.get_project()
                if proj: return proj
            except Exception:
                pass
                
        if hasattr(view, "get_plot"):
            try:
                plot = view.get_plot()
                if plot: return plot
            except Exception:
                pass
                
        return None

class IsProjectMember(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).is_project_member(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).is_project_member(obj)

class CanManageProject(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_project(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_project(obj)

class IsProjectOwnerOrCreator(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        auth = self.get_auth_service(request)
        return auth.role_for(obj) == "creator"

    def has_object_permission(self, request, view, obj):
        auth = self.get_auth_service(request)
        return auth.role_for(obj) == "creator"

class IsPlotMember(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).is_plot_member(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).is_plot_member(obj)

class CanManagePlot(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_plot(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_plot(obj)

class CanSubmitReport(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_submit_report(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_submit_report(obj)

class CanReviewReport(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_review_report(obj)

class CanSendProjectInvitation(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_project(obj)

class CanSendPlotInvitation(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_project(obj) # PM or Creator

class IsInvitee(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return obj.invitee == request.user

class IsInviterOrProjectOwner(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        if request.user == obj.invited_by:
            return True
        return self.get_auth_service(request).role_for(obj) == "creator"

class CanCreateWorkItem(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_create_work_item(obj)

class CanUpdateWorkItem(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_create_work_item(obj)

class CanDeleteWorkItem(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_project(obj)

class CanApproveWorkItem(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_approve(obj)

class CanCreateJobItem(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_create_job_item(obj)

class CanUpdateJobItem(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_create_job_item(obj)

class CanDeleteJobItem(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_project(obj)

class CanApproveJobItem(BaseRolePermission):
    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_approve(obj)

class CanManageFinance(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_finance(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_finance(obj)

class CanManageJobFinance(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_finance(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_finance(obj)

class CanManageExpenses(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).can_manage_finance(obj)

    def has_object_permission(self, request, view, obj):
        return self.get_auth_service(request).can_manage_finance(obj)

class CanManageDocuments(BaseRolePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        obj = self.get_scope_obj(view)
        if not obj:
            return request.method in SAFE_METHODS
        return self.get_auth_service(request).role_for(obj) in {"creator", "project_manager", "consultant"}

    def has_object_permission(self, request, view, obj):
        if view.action == "destroy" and request.user != obj.uploaded_by:
            return False
        return self.get_auth_service(request).role_for(obj) in {"creator", "project_manager", "consultant"}

# Backwards-compat alias
CanSendSiteInvitation = CanSendPlotInvitation
