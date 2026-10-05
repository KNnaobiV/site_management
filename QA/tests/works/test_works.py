import pytest
from playwright.sync_api import Page, expect
from utils.helpers import get_work_by_name
from utils.factories import ProjectFactory, PlotFactory

pytestmark = pytest.mark.works

@pytest.fixture
def parent_plot(project_creator):
    project = ProjectFactory.create(name="Work Parent Project", creator=project_creator)
    return PlotFactory.create(project=project, name="Work Parent Plot")

def test_create_work_with_budget(auth_page_creator: Page, base_url: str, parent_plot):
    page = auth_page_creator
    page.goto(f"{base_url}/plots/{parent_plot.id}")
    
    page.get_by_role("button", name="New Work").click()
    
    page.get_by_label("Work Name *").fill("QA Budget Work")
    page.get_by_label("Budget").fill("10000")
    page.get_by_label("Start Date *").fill("2026-03-01")
    page.get_by_label("Target End Date *").fill("2026-10-31")
    page.get_by_role("button", name="Create Work").click()
    
    expect(page.get_by_role("heading", name="QA Budget Work")).to_be_visible()
    
    work = get_work_by_name("QA Budget Work")
    assert work is not None
    assert float(work.budget) == 10000.00
    assert work.construction_plot == parent_plot

def test_create_work_without_budget(auth_page_creator: Page, base_url: str, parent_plot):
    page = auth_page_creator
    page.goto(f"{base_url}/plots/{parent_plot.id}")
    
    page.get_by_role("button", name="New Work").click()
    page.get_by_label("Work Name *").fill("QA No Budget Work")
    page.get_by_label("Start Date *").fill("2026-03-01")
    page.get_by_label("Target End Date *").fill("2026-10-31")
    page.get_by_role("button", name="Create Work").click()
    
    expect(page.get_by_role("heading", name="QA No Budget Work")).to_be_visible()
    work = get_work_by_name("QA No Budget Work")
    assert work.budget is None

def test_create_work_invalid_budget(auth_page_creator: Page, base_url: str, parent_plot):
    page = auth_page_creator
    page.goto(f"{base_url}/plots/{parent_plot.id}")
    
    page.get_by_role("button", name="New Work").click()
    page.get_by_label("Work Name *").fill("QA Invalid Budget Work")
    page.get_by_label("Budget").fill("-200")
    page.get_by_label("Start Date *").fill("2026-03-01")
    page.get_by_label("Target End Date *").fill("2026-10-31")
    
    is_valid = page.get_by_label("Budget").evaluate("el => el.validity.valid")
    if is_valid:
        page.get_by_role("button", name="Create Work").click()
        expect(page.get_by_text("must be greater than or equal to 0")).to_be_visible()
        
    work = get_work_by_name("QA Invalid Budget Work")
    assert work is None

def test_create_work_invalid_dates(auth_page_creator: Page, base_url: str, parent_plot):
    page = auth_page_creator
    page.goto(f"{base_url}/plots/{parent_plot.id}")
    
    page.get_by_role("button", name="New Work").click()
    page.get_by_label("Work Name *").fill("QA Invalid Dates Work")
    page.get_by_label("Start Date *").fill("2026-10-31")
    page.get_by_label("Target End Date *").fill("2026-03-01")
    page.get_by_role("button", name="Create Work").click()
    
    expect(page.get_by_text("End date cannot be before start date")).to_be_visible()
    work = get_work_by_name("QA Invalid Dates Work")
    assert work is None

def test_create_work_missing_required_fields(auth_page_creator: Page, base_url: str, parent_plot):
    page = auth_page_creator
    page.goto(f"{base_url}/plots/{parent_plot.id}")
    
    page.get_by_role("button", name="New Work").click()
    page.get_by_role("button", name="Create Work").click()
    
    is_valid = page.get_by_label("Work Name *").evaluate("el => el.validity.valid")
    assert not is_valid
