from core.roles import get_plot_role, get_project_role
from core.selectors.scope import get_scope


class AuthorizationService:
    def __init__(self, user):
        self.user = user

    def role_for(self, obj):
        scope = get_scope(obj)

        if scope.plot is not None:
            return get_plot_role(self.user, scope.plot)

        if scope.project is not None:
            return get_project_role(self.user, scope.project)

        return "none"

    def is_project_member(self, obj):
        return self.role_for(obj) != "none"

    def is_plot_member(self, obj):
        return self.role_for(obj) != "none"

    def can_manage_project(self, obj):
        return self.role_for(obj) in {"creator", "project_manager"}

    def can_manage_plot(self, obj):
        return self.role_for(obj) in {"creator", "project_manager", "foreman"}

    def can_create_work_item(self, obj):
        # PM and Creator can create (auto-approved). Foreman can create (needs approval).
        # Client cannot create.
        return self.role_for(obj) in {
            "creator",
            "project_manager",
            "foreman",
        }

    def can_create_job_item(self, obj):
        return self.role_for(obj) in {
            "creator",
            "project_manager",
            "foreman",
        }

    def can_submit_report(self, obj):
        return self.role_for(obj) in {
            "creator",
            "project_manager",
            "foreman",
        }

    def can_review_report(self, obj):
        return self.role_for(obj) in {
            "creator",
            "project_manager",
            "client",
            "consultant",
        }

    def can_manage_finance(self, obj):
        return self.role_for(obj) in {
            "creator",
            "project_manager",
            "foreman",
        }

    def can_approve(self, obj):
        """Used to determine if the user can approve/reject items (e.g. Work Items, Job Items)."""
        return self.role_for(obj) in {"creator", "project_manager"}
        
    def can_see_unapproved_items(self, obj):
        """Only PM and Creator can see unapproved items."""
        return self.role_for(obj) in {"creator", "project_manager"}

    def can_access_report_comments(self, obj):
        return self.role_for(obj) in {
            "creator",
            "project_manager",
            "foreman",
            "consultant",
        }
