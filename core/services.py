from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from core.models import (
    ConstructionProject, 
    ConstructionPlot,
    ProjectInvitation,
    PlotInvitation,
    ProjectRole,
    PlotRole,
    Notification,
)

User = get_user_model()

def _assert_can_invite_to_project(actor: User, project: ConstructionProject):
    if actor not in (project.project_manager, project.created_by):
        raise PermissionDenied(
            "Only creators and project managers can add users to the project"
        )

def _assert_can_invite_to_plot(actor: User, plot: ConstructionPlot):
    """
    Plot invitations may be sent by the project owner, project creator,
    or the project manager.
    """
    project = plot.construction_project
    allowed = {project.client, project.created_by, project.project_manager}
    if actor not in allowed:
        raise PermissionDenied(
            "Only the project owner, creator, or project manager can "
            "invite members to this plot."
        )


# ---------------------------------------------------------------------------
# Send invitations
# ---------------------------------------------------------------------------
 
def invite_to_project(
    *,
    actor: User,
    project: ConstructionProject,
    invitee: User,
    role: str,
    message: str = "",
) -> ProjectInvitation:
    """
    Create a ProjectInvitation.
    """
    _assert_can_invite_to_project(actor, project)
 
    if role not in ProjectRole.values:
        raise ValidationError(
            f"'{role}' is not a valid project role. "
            f"Choose from: {ProjectRole.values}"
        )
 
    # Guard: invitee already holds this role
    _check_not_already_assigned_project(project, invitee, role)
 
    invitation = ProjectInvitation.objects.create(
        project=project,
        invited_by=actor,
        invitee=invitee,
        role=role,
        message=message,
    )
 
    return invitation
 
 
def invite_to_plot(
    *,
    actor: User,
    plot: ConstructionPlot,
    invitee: User,
    role: str,
    message: str = "",
) -> PlotInvitation:
    """
    Create a PlotInvitation.
    """
    _assert_can_invite_to_plot(actor, plot)
 
    if role not in PlotRole.values:
        raise ValidationError(
            f"'{role}' is not a valid plot role. "
            f"Choose from: {PlotRole.values}"
        )
 
    _check_not_already_assigned_plot(plot, invitee, role)
 
    invitation = PlotInvitation.objects.create(
        plot=plot,
        invited_by=actor,
        invitee=invitee,
        role=role,
        message=message,
    )
 
    return invitation


# Backwards compat alias
invite_to_site = invite_to_plot
 
 
# ---------------------------------------------------------------------------
# Respond to invitations
# ---------------------------------------------------------------------------
 
def accept_project_invitation(*, actor: User, invitation: ProjectInvitation):
    """Accept a project invitation. Only the invitee may do this."""
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can accept this invitation.")
    invitation.accept()  # all logic lives in the model method
    Notification.objects.create(
        user=invitation.invited_by,
        project=invitation.project,
        message=f"{invitation.invitee.username} accepted your project invitation.",
        target_url=invitation.target_url,
        priority=Notification.Priority.NORMAL,
    )
 
 
def decline_project_invitation(*, actor: User, invitation: ProjectInvitation):
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can decline this invitation.")
    invitation.decline()
    Notification.objects.create(
        user=invitation.invited_by,
        project=invitation.project,
        message=f"{invitation.invitee.username} declined your project invitation.",
        target_url=invitation.target_url,
        priority=Notification.Priority.NORMAL,
    )
 
 
def revoke_project_invitation(*, actor: User, invitation: ProjectInvitation):
    """Revoke before the invitee responds. Only the inviter or project owner."""
    project = invitation.project
    allowed = {invitation.invited_by, project.client, project.created_by}
    if actor not in allowed:
        raise PermissionDenied("You are not allowed to revoke this invitation.")
    invitation.revoke()
 
 
def accept_plot_invitation(*, actor: User, invitation: PlotInvitation):
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can accept this invitation.")
    invitation.accept()
    Notification.objects.create(
        user=invitation.invited_by,
        project=invitation.plot.construction_project,
        message=f"{invitation.invitee.username} accepted your plot invitation.",
        target_url=invitation.target_url,
        priority=Notification.Priority.NORMAL,
    )
 
 
def decline_plot_invitation(*, actor: User, invitation: PlotInvitation):
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can decline this invitation.")
    invitation.decline()
    Notification.objects.create(
        user=invitation.invited_by,
        project=invitation.plot.construction_project,
        message=f"{invitation.invitee.username} declined your plot invitation.",
        target_url=invitation.target_url,
        priority=Notification.Priority.NORMAL,
    )
 
 
def revoke_plot_invitation(*, actor: User, invitation: PlotInvitation):
    plot = invitation.plot
    project = plot.construction_project
    allowed = {
        invitation.invited_by,
        project.client,
        project.created_by,
        project.project_manager,
    }
    if actor not in allowed:
        raise PermissionDenied("You are not allowed to revoke this invitation.")
    invitation.revoke()


# Backwards compat aliases
accept_site_invitation = accept_plot_invitation
decline_site_invitation = decline_plot_invitation
revoke_site_invitation = revoke_plot_invitation
 
 
# ---------------------------------------------------------------------------
# Internal guards – prevent duplicate role assignment
# ---------------------------------------------------------------------------
 
def _check_not_already_assigned_project(project, invitee, role):
    if role == ProjectRole.CLIENT and project.client == invitee:
        raise ValidationError(
            f"{invitee.username} is already the client on this project."
        )
    if role == ProjectRole.PROJECT_MANAGER and project.project_manager == invitee:
        raise ValidationError(
            f"{invitee.username} is already the project manager."
        )
    if role == ProjectRole.CONSULTANT and project.consultants.filter(pk=invitee.pk).exists():
        raise ValidationError(
            f"{invitee.username} is already a consultant on this project."
        )
 
 
def _check_not_already_assigned_plot(plot, invitee, role):
    if role == PlotRole.FOREMAN and plot.foreman == invitee:
        raise ValidationError(
            f"{invitee.username} is already the foreman on this plot."
        )
    if role == PlotRole.STOREKEEPER and plot.storekeeper == invitee:
        raise ValidationError(
            f"{invitee.username} is already the storekeeper on this plot."
        )


def assign_user_to_role_group(user, project_or_plot, role):
    if hasattr(project_or_plot, 'project_name'):
        group_name = f"{project_or_plot.project_name} {role}"
    else:
        group_name = (
            f"{project_or_plot.construction_project.project_name} {role}"
        )
    group, _ = Group.objects.get_or_create(name=group_name)
    group.user_set.add(user)
