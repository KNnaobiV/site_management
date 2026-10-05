import pytest
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, UserFactory
from backend.core.models import ProjectInvitation, PlotInvitation

pytestmark = pytest.mark.invitations

@pytest.fixture
def invite_project(project_creator):
    return ProjectFactory.create(name="Invite Project", creator=project_creator)

@pytest.fixture
def invite_plot(invite_project):
    return PlotFactory.create(project=invite_project, name="Invite Plot")

@pytest.fixture
def invite_user():
    user = UserFactory.create(username="qa_invitee", email="qa_invitee@example.com")
    yield user
    user.delete()

def test_invite_user_to_project(auth_page_creator: Page, base_url: str, invite_project, invite_user):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{invite_project.id}?tab=team")
    
    page.get_by_role("button", name="Invite Member").click()
    page.get_by_label("Username").fill(invite_user.username)
    page.get_by_label("Role").select_option(label="Project Manager")
    page.get_by_role("button", name="Send Invite").click()
    
    expect(page.get_by_text(f"Invited {invite_user.username}")).to_be_visible()
    
    invitation = ProjectInvitation.objects.filter(project=invite_project, invitee=invite_user).first()
    assert invitation is not None
    assert invitation.role == "project_manager"
    assert invitation.status == "pending"

def test_accept_project_invitation(page: Page, base_url: str, invite_project, invite_user):
    ProjectInvitation.objects.create(
        project=invite_project,
        invitee=invite_user,
        invited_by=invite_project.created_by,
        role="project_manager"
    )
    
    from utils.auth import login_user
    login_user(page, base_url, invite_user.email, "Password123!")
    
    page.goto(f"{base_url}/notifications")
    
    page.get_by_role("button", name="Accept").first.click()
    
    invite_project.refresh_from_db()
    assert invite_project.project_manager == invite_user

def test_reject_project_invitation(page: Page, base_url: str, invite_project, invite_user):
    ProjectInvitation.objects.create(
        project=invite_project,
        invitee=invite_user,
        invited_by=invite_project.created_by,
        role="consultant"
    )
    
    from utils.auth import login_user
    login_user(page, base_url, invite_user.email, "Password123!")
    
    page.goto(f"{base_url}/notifications")
    page.get_by_role("button", name="Decline").first.click()
    
    inv = ProjectInvitation.objects.filter(project=invite_project, invitee=invite_user).first()
    assert inv.status == "declined"
    
    page.goto(f"{base_url}/projects/{invite_project.id}")
    expect(page.get_by_text("Dashboard")).to_be_visible()

def test_invite_user_to_plot(auth_page_creator: Page, base_url: str, invite_plot, invite_user):
    page = auth_page_creator
    page.goto(f"{base_url}/plots/{invite_plot.id}?tab=team")
    
    page.get_by_role("button", name="Invite Member").click()
    page.get_by_label("Username").fill(invite_user.username)
    page.get_by_label("Role").select_option(label="Foreman")
    page.get_by_role("button", name="Send Invite").click()
    
    expect(page.get_by_text(f"Invited {invite_user.username}")).to_be_visible()
    
    invitation = PlotInvitation.objects.filter(plot=invite_plot, invitee=invite_user).first()
    assert invitation is not None
    assert invitation.role == "foreman"
    assert invitation.status == "pending"

def test_accept_plot_invitation(page: Page, base_url: str, invite_plot, invite_user):
    PlotInvitation.objects.create(
        plot=invite_plot,
        invitee=invite_user,
        invited_by=invite_plot.construction_project.created_by,
        role="foreman"
    )
    
    from utils.auth import login_user
    login_user(page, base_url, invite_user.email, "Password123!")
    
    page.goto(f"{base_url}/notifications")
    page.get_by_role("button", name="Accept").first.click()
    
    assert invite_plot.foremen.filter(id=invite_user.id).exists()

def test_reject_plot_invitation(page: Page, base_url: str, invite_plot, invite_user):
    PlotInvitation.objects.create(
        plot=invite_plot,
        invitee=invite_user,
        invited_by=invite_plot.construction_project.created_by,
        role="storekeeper"
    )
    
    from utils.auth import login_user
    login_user(page, base_url, invite_user.email, "Password123!")
    
    page.goto(f"{base_url}/notifications")
    page.get_by_role("button", name="Decline").first.click()
    
    inv = PlotInvitation.objects.filter(plot=invite_plot, invitee=invite_user).first()
    assert inv.status == "declined"
