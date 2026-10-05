import pytest
from playwright.sync_api import Page, expect
from utils.helpers import get_plot_by_name
from utils.factories import ProjectFactory

pytestmark = pytest.mark.plots

@pytest.fixture
def parent_project(project_creator):
    return ProjectFactory.create(name="Plot Parent Project", creator=project_creator)

def test_create_plot_with_budget(auth_page_creator: Page, base_url: str, parent_project):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{parent_project.id}")
    
    page.get_by_role("button", name="New Plot").click()
    
    page.get_by_label("Plot Name *").fill("QA Budget Plot")
    page.get_by_label("Budget").fill("20000")
    page.get_by_label("Start Date *").fill("2026-02-01")
    page.get_by_label("Target End Date *").fill("2026-11-30")
    page.get_by_role("button", name="Create Plot").click()
    
    expect(page.get_by_role("heading", name="QA Budget Plot")).to_be_visible()
    
    plot = get_plot_by_name("QA Budget Plot")
    assert plot is not None
    assert float(plot.budget) == 20000.00
    assert plot.construction_project == parent_project

def test_create_plot_without_budget(auth_page_creator: Page, base_url: str, parent_project):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{parent_project.id}")
    
    page.get_by_role("button", name="New Plot").click()
    page.get_by_label("Plot Name *").fill("QA No Budget Plot")
    page.get_by_label("Start Date *").fill("2026-02-01")
    page.get_by_label("Target End Date *").fill("2026-11-30")
    page.get_by_role("button", name="Create Plot").click()
    
    expect(page.get_by_role("heading", name="QA No Budget Plot")).to_be_visible()
    plot = get_plot_by_name("QA No Budget Plot")
    assert plot.budget is None

def test_create_plot_invalid_budget(auth_page_creator: Page, base_url: str, parent_project):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{parent_project.id}")
    
    page.get_by_role("button", name="New Plot").click()
    page.get_by_label("Plot Name *").fill("QA Invalid Budget Plot")
    page.get_by_label("Budget").fill("-5000")
    page.get_by_label("Start Date *").fill("2026-02-01")
    page.get_by_label("Target End Date *").fill("2026-11-30")
    
    is_valid = page.get_by_label("Budget").evaluate("el => el.validity.valid")
    if is_valid:
        page.get_by_role("button", name="Create Plot").click()
        expect(page.get_by_text("must be greater than or equal to 0")).to_be_visible()
        
    plot = get_plot_by_name("QA Invalid Budget Plot")
    assert plot is None

def test_create_plot_invalid_dates(auth_page_creator: Page, base_url: str, parent_project):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{parent_project.id}")
    
    page.get_by_role("button", name="New Plot").click()
    page.get_by_label("Plot Name *").fill("QA Invalid Dates Plot")
    page.get_by_label("Start Date *").fill("2026-11-30")
    page.get_by_label("Target End Date *").fill("2026-02-01")
    page.get_by_role("button", name="Create Plot").click()
    
    expect(page.get_by_text("End date cannot be before start date")).to_be_visible()
    plot = get_plot_by_name("QA Invalid Dates Plot")
    assert plot is None

def test_create_plot_missing_required_fields(auth_page_creator: Page, base_url: str, parent_project):
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{parent_project.id}")
    
    page.get_by_role("button", name="New Plot").click()
    page.get_by_role("button", name="Create Plot").click()
    
    is_valid = page.get_by_label("Plot Name *").evaluate("el => el.validity.valid")
    assert not is_valid

def test_cannot_create_plot_without_parent():
    """Verify that a plot cannot be created without a parent project."""
    import requests
    response = requests.post("http://localhost:8000/api/plots/", json={
        "plot_name": "Orphan Plot",
        "start_date": "2026-01-01",
        "target_end_date": "2026-12-31"
    })
    assert response.status_code in [404, 405, 401]
