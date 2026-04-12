from rest_framework import permissions
from .models import ConstructionProject


class IsProjectMember(permissions.BasePermission):
    """
    Custom permission to only allow members of a project to access certain views.
    """

    def has_permission(self, request, view):
        # Check if the user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # check if the user belongs to the project group
        is_member = request.user.groups.filter(
            name__in=ConstructionProject.objects.values_list('project_name', flat=True)
        ).exists()
        return is_member