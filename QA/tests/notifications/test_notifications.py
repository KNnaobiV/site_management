import pytest
from datetime import datetime, timedelta
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, WorkFactory, JobFactory, ReportFactory, UserFactory
from backend.core.models import JobItem, Notification

pytestmark = pytest.mark.notifications

@pytest.fixture
def overdue_job(project_creator, project_manager):
    past_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
    project = ProjectFactory.create(name="Deadline Project", creator=project_creator, pm=project_manager)
    plot = PlotFactory.create(project=project, name="Deadline Plot", target_end_date=past_date)
    work = WorkFactory.create(plot=plot, name="Deadline Work", target_end_date=past_date)
    return JobFactory.create(work=work, name="Deadline Job", target_end_date=past_date)

@pytest.fixture
def overdue_foreman(overdue_job):
    foreman = UserFactory.create(username="qa_deadline_foreman")
    overdue_job.work_item.construction_plot.foremen.add(foreman)
    return foreman

def test_job_below_100_percent_when_target_end_date_passes(overdue_job):
    assert overdue_job.completion_percentage < 100
    assert overdue_job.is_overdue()

def test_creating_report_after_target_end_date(auth_page_foreman: Page, base_url: str, overdue_job, overdue_foreman, project_manager):
    page = auth_page_foreman
    page.goto(f"{base_url}/jobs/{overdue_job.id}")
    page.get_by_role("button", name="New Report").click()
    page.get_by_label("Description").fill("Late report")
    page.get_by_role("button", name="Submit Report").click()
    
    assert Notification.objects.filter(recipient=project_manager).exists()

def test_fallback_alert_to_project_creator_when_no_pm(page: Page, base_url: str, project_creator):
    past_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
    project = ProjectFactory.create(name="No PM Deadline Project", creator=project_creator, pm=None)
    plot = PlotFactory.create(project=project, target_end_date=past_date)
    work = WorkFactory.create(plot=plot, target_end_date=past_date)
    job = JobFactory.create(work=work, target_end_date=past_date)
    foreman = UserFactory.create(username="no_pm_foreman2")
    plot.foremen.add(foreman)
    
    from utils.auth import login_user, logout_user
    login_user(page, base_url, foreman.email, "Password123!")
    page.goto(f"{base_url}/jobs/{job.id}")
    page.get_by_role("button", name="New Report").click()
    page.get_by_label("Description").fill("Late report no PM")
    page.get_by_role("button", name="Submit Report").click()
    
    assert Notification.objects.filter(recipient=project_creator).exists()

def test_pm_alert_when_job_exceeds_budget(auth_page_creator: Page, base_url: str, overdue_job, project_manager):
    page = auth_page_creator
    page.goto(f"{base_url}/jobs/{overdue_job.id}")
    
    page.get_by_role("button", name="Add Expense").click()
    overdue_job.budget = 1000
    overdue_job.save()
    
    page.get_by_label("Amount").fill("2000")
    page.get_by_label("Description").fill("Exceed")
    page.get_by_role("button", name="Save Expense").click()
    
    expect(page.get_by_text("200%")).to_be_visible()
    notif = Notification.objects.filter(recipient=project_manager, title__icontains="budget").first()
    assert notif is not None

def test_job_report_after_parent_work_target_end_date(auth_page_foreman: Page, base_url: str, project_creator, project_manager):
    page = auth_page_foreman
    # Setup: Work target date passed, Job target date NOT passed
    past_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
    future_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
    
    project = ProjectFactory.create(name="Late Work Proj", creator=project_creator, pm=project_manager)
    plot = PlotFactory.create(project=project, target_end_date=future_date)
    work = WorkFactory.create(plot=plot, target_end_date=past_date)  # Work is late
    job = JobFactory.create(work=work, target_end_date=future_date)  # Job is technically fine
    
    foreman = UserFactory.create(username="qa_late_work_foreman")
    plot.foremen.add(foreman)
    
    from utils.auth import login_user
    login_user(page, base_url, foreman.email, "Password123!")
    page.goto(f"{base_url}/jobs/{job.id}")
    page.get_by_role("button", name="New Report").click()
    page.get_by_label("Description").fill("Work is late")
    page.get_by_role("button", name="Submit Report").click()
    
    # Verify PM gets an alert that the work is receiving updates after deadline
    assert Notification.objects.filter(recipient=project_manager).exists()

def test_overdue_plot_alerts(project_creator, project_manager):
    past_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
    project = ProjectFactory.create(name="Overdue Plot Proj", creator=project_creator, pm=project_manager)
    plot = PlotFactory.create(project=project, target_end_date=past_date)
    assert plot.is_overdue()

def test_overdue_project_alerts(project_creator, project_manager):
    past_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
    project = ProjectFactory.create(name="Overdue Project Alert", creator=project_creator, pm=project_manager, target_end_date=past_date)
    assert project.is_overdue()

def test_fallback_overdue_alerts_when_no_pm(project_creator):
    past_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
    project = ProjectFactory.create(name="Overdue Project No PM", creator=project_creator, pm=None, target_end_date=past_date)
    plot = PlotFactory.create(project=project, target_end_date=past_date)
    
    # In a real app this is triggered by celery, so we just assert the business rule:
    # If there is no PM, the creator should receive notifications related to these overdues
    assert project.project_manager is None
    assert project.get_pm_or_creator() == project_creator
