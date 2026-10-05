import pytest
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, WorkFactory, JobFactory, ReportFactory, UserFactory
from backend.core.models import ReportComment

pytestmark = pytest.mark.reports

@pytest.fixture
def report_job(project_creator, project_manager):
    project = ProjectFactory.create(name="Report Project", creator=project_creator, pm=project_manager)
    plot = PlotFactory.create(project=project, name="Report Plot")
    work = WorkFactory.create(plot=plot, name="Report Work")
    return JobFactory.create(work=work, name="Report Job")

@pytest.fixture
def report_foreman(report_job):
    foreman = UserFactory.create(username="qa_report_foreman")
    report_job.work_item.construction_plot.foremen.add(foreman)
    return foreman

@pytest.fixture
def report_consultant(report_job):
    consultant = UserFactory.create(username="qa_report_consultant")
    report_job.work_item.construction_plot.construction_project.consultants.add(consultant)
    return consultant

def test_report_creation_as_foreman(page: Page, base_url: str, report_job, report_foreman):
    from utils.auth import login_user
    login_user(page, base_url, report_foreman.email, "Password123!")
    
    page.goto(f"{base_url}/jobs/{report_job.id}")
    page.get_by_role("button", name="New Report").click()
    page.get_by_label("Description").fill("Foreman foundation report.")
    page.get_by_role("button", name="Submit Report").click()
    
    expect(page.get_by_text("Foreman foundation report.")).to_be_visible()
    expect(page.get_by_text("pending")).to_be_visible()

def test_report_creation_as_consultant(page: Page, base_url: str, report_job, report_consultant):
    from utils.auth import login_user
    login_user(page, base_url, report_consultant.email, "Password123!")
    
    page.goto(f"{base_url}/jobs/{report_job.id}")
    page.get_by_role("button", name="New Report").click()
    page.get_by_label("Description").fill("Consultant foundation report.")
    page.get_by_role("button", name="Submit Report").click()
    
    expect(page.get_by_text("Consultant foundation report.")).to_be_visible()
    expect(page.get_by_text("pending")).to_be_visible()

def test_report_creation_as_pm(auth_page_pm: Page, base_url: str, report_job):
    page = auth_page_pm
    page.goto(f"{base_url}/jobs/{report_job.id}")
    page.get_by_role("button", name="New Report").click()
    page.get_by_label("Description").fill("PM foundation report.")
    page.get_by_role("button", name="Submit Report").click()
    
    expect(page.get_by_text("PM foundation report.")).to_be_visible()
    # PM reports auto-approve
    expect(page.get_by_text("approved")).to_be_visible()

def test_approving_foreman_report(page: Page, base_url: str, report_job, report_foreman, project_manager):
    report = ReportFactory.create(job=report_job, reporter=report_foreman, description="Need approval")
    from utils.auth import login_user
    login_user(page, base_url, project_manager.email, "Password123!")
    
    page.goto(f"{base_url}/jobs/{report_job.id}")
    page.get_by_role("button", name="Approve").first.click()
    
    expect(page.get_by_text("approved")).to_be_visible()
    report.refresh_from_db()
    assert report.approval_status == "approved"
    
def test_approving_consultant_report(page: Page, base_url: str, report_job, report_consultant, project_manager):
    report = ReportFactory.create(job=report_job, reporter=report_consultant, description="Consultant approval")
    from utils.auth import login_user
    login_user(page, base_url, project_manager.email, "Password123!")
    
    page.goto(f"{base_url}/jobs/{report_job.id}")
    page.get_by_role("button", name="Approve").first.click()
    
    expect(page.get_by_text("approved")).to_be_visible()
    report.refresh_from_db()
    assert report.approval_status == "approved"

def test_unauthorized_user_attempting_approval(page: Page, base_url: str, report_job, report_foreman, unrelated_user):
    report = ReportFactory.create(job=report_job, reporter=report_foreman, description="Need approval")
    from utils.auth import login_user
    login_user(page, base_url, unrelated_user.email, "Password123!")
    
    page.goto(f"{base_url}/jobs/{report_job.id}")
    expect(page.get_by_text("Dashboard")).to_be_visible() # Redirected

def test_report_comments_persistence(auth_page_pm: Page, base_url: str, report_job, report_foreman):
    report = ReportFactory.create(job=report_job, reporter=report_foreman, description="Comment on this")
    
    page = auth_page_pm
    page.goto(f"{base_url}/jobs/{report_job.id}")
    
    page.get_by_role("button", name="Comments").first.click()
    page.get_by_placeholder("Add a comment...").fill("This looks good.")
    page.get_by_role("button", name="Post").click()
    
    expect(page.get_by_text("This looks good.")).to_be_visible()
    
    comment = ReportComment.objects.filter(job_report=report).first()
    assert comment is not None
    assert comment.comment == "This looks good."

def test_report_comment_notifications(page: Page, base_url: str, report_job, report_foreman, project_manager):
    # Setup report and comment by PM
    report = ReportFactory.create(job=report_job, reporter=report_foreman, description="Comment on this")
    ReportComment.objects.create(job_report=report, author=project_manager, comment="Please revise.")
    
    # Login as foreman and check notifications
    from utils.auth import login_user
    login_user(page, base_url, report_foreman.email, "Password123!")
    
    page.goto(f"{base_url}/notifications")
    expect(page.get_by_text("Please revise.")).to_be_visible()
    
    # PM should not be notified of their own comment
    logout_user(page, base_url)
    login_user(page, base_url, project_manager.email, "Password123!")
    page.goto(f"{base_url}/notifications")
    expect(page.get_by_text("Please revise.")).not_to_be_visible()
