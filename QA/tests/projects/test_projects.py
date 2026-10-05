import pytest
from playwright.sync_api import Page, expect
from utils.helpers import get_project_by_name

pytestmark = pytest.mark.projects

def test_create_project_with_budget(auth_page_creator: Page, base_url: str):
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="New Project").click()
    
    page.get_by_label("Project Name *").fill("QA Budget Project")
    page.get_by_label("Budget").fill("50000")
    page.get_by_label("Start Date *").fill("2026-01-01")
    page.get_by_label("Target End Date *").fill("2026-12-31")
    page.get_by_role("button", name="Create Project").click()
    
    # Assert successful creation and redirect
    expect(page.get_by_role("heading", name="QA Budget Project")).to_be_visible()
    
    # Verify DB state
    proj = get_project_by_name("QA Budget Project")
    assert proj is not None
    assert float(proj.budget) == 50000.00
    assert proj.created_by.email == "qa_creator@example.com"

def test_create_project_without_budget(auth_page_creator: Page, base_url: str):
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="New Project").click()
    
    page.get_by_label("Project Name *").fill("QA No Budget Project")
    page.get_by_label("Start Date *").fill("2026-01-01")
    page.get_by_label("Target End Date *").fill("2026-12-31")
    page.get_by_role("button", name="Create Project").click()
    
    # Assert successful creation
    expect(page.get_by_role("heading", name="QA No Budget Project")).to_be_visible()
    
    # Verify DB state
    proj = get_project_by_name("QA No Budget Project")
    assert proj is not None
    assert proj.budget is None

def test_create_project_missing_required_fields(auth_page_creator: Page, base_url: str):
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="New Project").click()
    page.get_by_role("button", name="Create Project").click()
    
    # Form should not submit
    is_valid = page.get_by_label("Project Name *").evaluate("el => el.validity.valid")
    assert not is_valid

def test_create_project_end_date_before_start_date(auth_page_creator: Page, base_url: str):
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="New Project").click()
    page.get_by_label("Project Name *").fill("QA Invalid Dates")
    page.get_by_label("Start Date *").fill("2026-12-31")
    page.get_by_label("Target End Date *").fill("2026-01-01")
    page.get_by_role("button", name="Create Project").click()
    
    # Look for validation error toast or message
    expect(page.get_by_text("End date cannot be before start date")).to_be_visible()
    
    # Verify DB state is empty
    proj = get_project_by_name("QA Invalid Dates")
    assert proj is None

def test_create_project_negative_budget(auth_page_creator: Page, base_url: str):
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="New Project").click()
    page.get_by_label("Project Name *").fill("QA Negative Budget")
    page.get_by_label("Budget").fill("-500")
    page.get_by_label("Start Date *").fill("2026-01-01")
    page.get_by_label("Target End Date *").fill("2026-12-31")
    
    # Either HTML5 validation stops it, or backend stops it
    is_valid = page.get_by_label("Budget").evaluate("el => el.validity.valid")
    if is_valid:
        page.get_by_role("button", name="Create Project").click()
        expect(page.get_by_text("must be greater than or equal to 0")).to_be_visible()
        
    proj = get_project_by_name("QA Negative Budget")
    assert proj is None
