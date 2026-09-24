from rest_framework.filters import BaseFilterBackend
from django.db.models import Q
from core.services.authorization import AuthorizationService


class ApprovalVisibilityFilterBackend(BaseFilterBackend):
    """
    Filters out unapproved items (WorkItems, JobItems) unless the user 
    is the Project Manager, Project Creator, or the one who created the item.
    """

    def filter_queryset(self, request, queryset, view):
        # We only apply this to views that have an approval field.
        if not hasattr(queryset.model, "is_approved"):
            return queryset
            
        auth = AuthorizationService(request.user)
        
        # We need to determine if they can see unapproved items globally.
        # But wait, AuthorizationService works per-object.
        # However, if they are PM or Creator on the *parent* plot/project, they can see unapproved.
        # ViewSets often have `get_scope_object` or `get_plot`.
        
        scope_obj = getattr(view, "get_scope_object", lambda: None)()
        
        # If there's a scope_obj, we check if they are PM/Creator for it.
        # Otherwise, they can only see unapproved if they created it.
        if scope_obj and auth.can_see_unapproved_items(scope_obj):
            return queryset
            
        # Global or non-privileged view: only show approved items OR items the user created themselves.
        return queryset.filter(
            Q(is_approved=True) | Q(created_by=request.user)
        )
