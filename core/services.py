from django.contrib.auth.models import get_user_model, Group
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from core.models import (
    ConstructionProject, 
    ConstructionSite,
    ProjectInvitation,
    SiteInvitation,
    ProjectRole,
    SiteRole,
    ProjectMembership, 
    Invitation,
    RoleChoices,
    SiteMembership,
)

User = get_user_model()

def _assert_can_invite_to_project(actor: User, project: ConstructionProject):
    if actor not in (project.project_manager, project.created_by):
        raise PermissionDenied(
            "Only creators and project managers can add users to the project"
        )

def _assert_can_invite_to_site(actor: User, site: ConstructionSite):
    """
    Site invitations may be sent by the project owner, project creator,
    or the project manager.
    """
    project = site.construction_project
    allowed = {project.client, project.created_by, project.project_manager}
    if actor not in allowed:
        raise PermissionDenied(
            "Only the project owner, creator, or project manager can "
            "invite members to this site."
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
 
    Parameters
    ----------
    actor   : the user sending the invitation (must be owner/creator)
    project : the ConstructionProject to invite to
    invitee : the user being invited
    role    : one of ProjectRole choices ('client', 'project_manager', 'consultant')
    message : optional personal message
 
    Returns
    -------
    The newly created ProjectInvitation instance.
 
    Raises
    ------
    PermissionDenied  – actor is not allowed to invite
    ValidationError   – role is invalid or invitee already has the role
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
 
    # TODO: send email/notification here
    # notify_invitation(invitation)
 
    return invitation
 
 
def invite_to_site(
    *,
    actor: User,
    site: ConstructionSite,
    invitee: User,
    role: str,
    message: str = "",
) -> SiteInvitation:
    """
    Create a SiteInvitation.
 
    Parameters
    ----------
    actor   : the user sending the invitation
    site    : the ConstructionSite to invite to
    invitee : the user being invited
    role    : one of SiteRole choices ('foreman', 'storekeeper')
    message : optional personal message
    """
    _assert_can_invite_to_site(actor, site)
 
    if role not in SiteRole.values:
        raise ValidationError(
            f"'{role}' is not a valid site role. "
            f"Choose from: {SiteRole.values}"
        )
 
    _check_not_already_assigned_site(site, invitee, role)
 
    invitation = SiteInvitation.objects.create(
        site=site,
        invited_by=actor,
        invitee=invitee,
        role=role,
        message=message,
    )
 
    # TODO: send email/notification here
    # notify_invitation(invitation)
 
    return invitation
 
 
# ---------------------------------------------------------------------------
# Respond to invitations
# ---------------------------------------------------------------------------
 
def accept_project_invitation(*, actor: User, invitation: ProjectInvitation):
    """Accept a project invitation. Only the invitee may do this."""
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can accept this invitation.")
    invitation.accept()  # all logic lives in the model method
 
 
def decline_project_invitation(*, actor: User, invitation: ProjectInvitation):
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can decline this invitation.")
    invitation.decline()
 
 
def revoke_project_invitation(*, actor: User, invitation: ProjectInvitation):
    """Revoke before the invitee responds. Only the inviter or project owner."""
    project = invitation.project
    allowed = {invitation.invited_by, project.client, project.created_by}
    if actor not in allowed:
        raise PermissionDenied("You are not allowed to revoke this invitation.")
    invitation.revoke()
 
 
def accept_site_invitation(*, actor: User, invitation: SiteInvitation):
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can accept this invitation.")
    invitation.accept()
 
 
def decline_site_invitation(*, actor: User, invitation: SiteInvitation):
    if actor != invitation.invitee:
        raise PermissionDenied("Only the invitee can decline this invitation.")
    invitation.decline()
 
 
def revoke_site_invitation(*, actor: User, invitation: SiteInvitation):
    site = invitation.site
    project = site.construction_project
    allowed = {
        invitation.invited_by,
        project.client,
        project.created_by,
        project.project_manager,
    }
    if actor not in allowed:
        raise PermissionDenied("You are not allowed to revoke this invitation.")
    invitation.revoke()
 
 
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
 
 
def _check_not_already_assigned_site(site, invitee, role):
    if role == SiteRole.FOREMAN and site.foreman == invitee:
        raise ValidationError(
            f"{invitee.username} is already the foreman on this site."
        )
    if role == SiteRole.STOREKEEPER and site.storekeeper == invitee:
        raise ValidationError(
            f"{invitee.username} is already the storekeeper on this site."
        )

def invite_user_to_project_or_site(email, project, role, invited_by, site=None):
    if not invited_by.has_perm('core.add_invitation', project):
        raise PermissionDenied("You do not have permission to invite users to this project.")

    if role not in RoleChoices.values:
        raise ValueError("Invalid role specified.")
    
    if site:
        # Create a site invitation
        invitation = Invitation.objects.create(
            email=email,
            project=project,
            site=site,
            role=role,
            invited_by=invited_by
        )
    else:
        # Create a project invitation
        invitation = Invitation.objects.create(
            email=email,
            project=project,
            role=role,
            invited_by=invited_by
        )
    return invitation


def accept_invitation(token, user):
    try:
        invitation = Invitation.objects.get(token=token)
    except Invitation.DoesNotExist:
        raise ValueError("Invalid invitation token.")
    if invitation.accepted:
        raise ValueError("This invitation has already been accepted.")
    if invitation.email != user.email:
        raise ValueError("This invitation was not sent to your email address.")
    invitation.accepted = True
    invitation.save()

    if invitation.site:
        SiteMembership.objects.get_or_create(
            user=user,
            site=invitation.site,
            role=invitation.role,
            invited_by=invitation.invited_by
        )
    else:
        ProjectMembership.objects.get_or_create(
            user=user,
            project=invitation.project,
            role=invitation.role,
            invited_by=invitation.invited_by
        )

    return invitation


def assign_user_to_role_group(user, project_or_site, role):
    if hasattr(project_or_site, 'project_name'):
        # it is a site
        group_name = f"{project_or_site.project_name} {role}"
    else:
        # it is a project
        group_name = (
            f"{project_or_site.construction_project.project_name} {role}"
        )
    group, _ = Group.objects.get_or_create(name=group_name)
    group.user_set.add(user)

