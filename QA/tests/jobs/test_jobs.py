import pytest
from playwright.sync_api import Page, expect
from utils.helpers import get_job_by_name
from utils.factories import ProjectFactory, PlotFactory, WorkFactory

pytestmark = pytest.mark.jobs

@pytest.fixture
def parent_work(project_creator):
    project = ProjectFactory.create(name="Job Parent Project", creator=project_creator)
    plot = PlotFactory.create(project=project, name="Job Parent Plot")
    return WorkFactory.create(plot=plot, name="Job Parent Work")

def test_create_job_with_budget(auth_page_creator: Page, base_url: str, parent_work):
    page = auth_page_creator
    page.goto(f"{base_url}/works/{parent_work.id}")
    
    page.get_by_role("button", name="New Job").click()
    
    page.get_by_label("Job Name *").fill("QA Budget Job")
    page.get_by_label("Budget").fill("5000")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    
    expect(page.get_by_role("heading", name="QA Budget Job")).to_be_visible()
    
    job = get_job_by_name("QA Budget Job")
    assert job is not None
    assert float(job.budget) == 5000.00
    assert job.work_item == parent_work

def test_create_job_without_budget(auth_page_creator: Page, base_url: str, parent_work):
    page = auth_page_creator
    page.goto(f"{base_url}/works/{parent_work.id}")
    
    page.get_by_role("button", name="New Job").click()
    
    page.get_by_label("Job Name *").fill("QA No Budget Job")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    
    expect(page.get_by_role("heading", name="QA No Budget Job")).to_be_visible()
    
    job = get_job_by_name("QA No Budget Job")
    assert job.budget is None

def test_create_job_invalid_budget(auth_page_creator: Page, base_url: str, parent_work):
    page = auth_page_creator
    page.goto(f"{base_url}/works/{parent_work.id}")
    
    page.get_by_role("button", name="New Job").click()
    page.get_by_label("Job Name *").fill("QA Invalid Budget Job")
    page.get_by_label("Budget").fill("-500")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    
    is_valid = page.get_by_label("Budget").evaluate("el => el.validity.valid")
    if is_valid:
        page.get_by_role("button", name="Create Job").click()
        expect(page.get_by_text("must be greater than or equal to 0")).to_be_visible()
        
    job = get_job_by_name("QA Invalid Budget Job")
    assert job is None

def test_create_job_missing_required_fields(auth_page_creator: Page, base_url: str, parent_work):
    page = auth_page_creator
    page.goto(f"{base_url}/works/{parent_work.id}")
    
    page.get_by_role("button", name="New Job").click()
    page.get_by_role("button", name="Create Job").click()
    
    is_valid = page.get_by_label("Job Name *").evaluate("el => el.validity.valid")
    assert not is_valid

def test_create_multiple_jobs_mixed_budgets(auth_page_creator: Page, base_url: str, parent_work):
    page = auth_page_creator
    
    # Create Job 1 (With Budget)
    page.goto(f"{base_url}/works/{parent_work.id}")
    page.get_by_role("button", name="New Job").click()
    page.get_by_label("Job Name *").fill("QA Multi Job 1")
    page.get_by_label("Budget").fill("2000")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    expect(page.get_by_role("heading", name="QA Multi Job 1")).to_be_visible()
    
    # Create Job 2 (Without Budget)
    page.goto(f"{base_url}/works/{parent_work.id}")
    page.get_by_role("button", name="New Job").click()
    page.get_by_label("Job Name *").fill("QA Multi Job 2")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    expect(page.get_by_role("heading", name="QA Multi Job 2")).to_be_visible()
    
    # Check total budget on UI
    page.goto(f"{base_url}/works/{parent_work.id}")
    expect(page.get_by_text("QA Multi Job 1")).to_be_visible()
    expect(page.get_by_text("QA Multi Job 2")).to_be_visible()

def test_create_multiple_jobs_without_budgets(auth_page_creator: Page, base_url: str, parent_work):
    page = auth_page_creator
    
    # Create Job 1 (Without Budget)
    page.goto(f"{base_url}/works/{parent_work.id}")
    page.get_by_role("button", name="New Job").click()
    page.get_by_label("Job Name *").fill("QA No Budget Job 1")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    expect(page.get_by_role("heading", name="QA No Budget Job 1")).to_be_visible()
    
    # Create Job 2 (Without Budget)
    page.goto(f"{base_url}/works/{parent_work.id}")
    page.get_by_role("button", name="New Job").click()
    page.get_by_label("Job Name *").fill("QA No Budget Job 2")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    expect(page.get_by_role("heading", name="QA No Budget Job 2")).to_be_visible()
    
    # Check on UI
    page.goto(f"{base_url}/works/{parent_work.id}")
    expect(page.get_by_text("QA No Budget Job 1")).to_be_visible()
    expect(page.get_by_text("QA No Budget Job 2")).to_be_visible()

