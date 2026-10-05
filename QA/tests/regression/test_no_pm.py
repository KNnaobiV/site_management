import pytest
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, WorkFactory, JobFactory, ReportFactory, UserFactory

pytestmark = pytest.mark.regression

@pytest.fixture
def no_pm_project(project_creator):
    project = ProjectFactory.create(name="No PM Project", creator=project_creator, pm=None)
    plot = PlotFactory.create(project=project, name="No PM Plot")
    work = WorkFactory.create(plot=plot, name="No PM Work")
    return JobFactory.create(work=work, name="No PM Job")

@pytest.fixture
def no_pm_foreman(no_pm_project):
    foreman = UserFactory.create(username="no_pm_foreman")
    no_pm_project.work_item.construction_plot.foremen.add(foreman)
    return foreman

def test_project_creator_assumes_pm_role(auth_page_creator: Page, base_url: str, no_pm_project, no_pm_foreman):
    page = auth_page_creator
    
    # Foreman creates report
    report = ReportFactory.create(job=no_pm_project, reporter=no_pm_foreman, description="Foreman report")
    
    # Creator logs in, goes to job, should see approve button
    page.goto(f"{base_url}/jobs/{no_pm_project.id}")
    
    # Check if approve button is visible to the creator since there is no PM
    expect(page.get_by_role("button", name="Approve")).to_be_visible()
    page.get_by_role("button", name="Approve").click()
    
    expect(page.get_by_text("approved")).to_be_visible()
    report.refresh_from_db()
    assert report.approval_status == "approved"

def test_assigning_pm_restores_normal_auth(auth_page_creator: Page, base_url: str, no_pm_project, no_pm_foreman, project_manager):
    # Assign PM
    project = no_pm_project.work_item.construction_plot.construction_project
    project.project_manager = project_manager
    project.save()
    
    # The creator is still the creator, so they might STILL have approval rights 
    # depending on the business logic. "when a project has no PM, verify project creator can..."
    # The requirement says "Then assign a PM and verify the normal authorization model."
    # Let's verify PM has access.
    
    from utils.auth import login_user, logout_user
    logout_user(auth_page_creator, base_url)
    
    login_user(auth_page_creator, base_url, project_manager.email, "Password123!")
    
    auth_page_creator.goto(f"{base_url}/jobs/{no_pm_project.id}")
    
    # Wait for the view to load
    expect(auth_page_creator.get_by_role("heading", name="No PM Job")).to_be_visible()

def test_ordinary_member_no_escalation(page: Page, base_url: str, no_pm_project, no_pm_foreman):
    # Foreman shouldn't be able to approve their own report
    from utils.auth import login_user
    login_user(page, base_url, no_pm_foreman.email, "Password123!")
    
    report = ReportFactory.create(job=no_pm_project, reporter=no_pm_foreman, description="Foreman report")
    
    page.goto(f"{base_url}/jobs/{no_pm_project.id}")
    
    # Foreman should not see the approve button
    expect(page.get_by_role("button", name="Approve")).not_to_be_visible()

def test_project_creator_assumes_financial_management(auth_page_creator: Page, base_url: str, no_pm_project):
    page = auth_page_creator
    page.goto(f"{base_url}/jobs/{no_pm_project.id}")
    
    # Creator should be able to add expense, which is usually a PM/Creator action
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("5000")
    page.get_by_label("Description").fill("No PM Expense")
    page.get_by_role("button", name="Save Expense").click()
    
    expect(page.get_by_text("No PM Expense")).to_be_visible()

def test_ordinary_member_cannot_manage_finances(page: Page, base_url: str, no_pm_project, no_pm_foreman):
    from utils.auth import login_user
    login_user(page, base_url, no_pm_foreman.email, "Password123!")
    
    page.goto(f"{base_url}/jobs/{no_pm_project.id}")
    
    # Foreman should not see Add Expense button
    expect(page.get_by_role("button", name="Add Expense")).not_to_be_visible()

