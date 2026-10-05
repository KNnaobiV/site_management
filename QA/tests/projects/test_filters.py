import pytest
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, WorkFactory, JobFactory

pytestmark = pytest.mark.projects

def test_project_filtering_by_status(auth_page_creator: Page, base_url: str, project_creator):
    p1 = ProjectFactory.create(name="Active Project", creator=project_creator)
    p2 = ProjectFactory.create(name="Completed Project", creator=project_creator)
    p2.status = "completed"
    p2.save()
    
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    expect(page.get_by_text("Active Project")).to_be_visible()
    expect(page.get_by_text("Completed Project")).to_be_visible()
    
    page.get_by_role("button", name="Filter").click()
    page.get_by_label("Status").select_option("active")
    page.get_by_role("button", name="Apply Filters").click()
    
    expect(page.get_by_text("Active Project")).to_be_visible()
    expect(page.get_by_text("Completed Project")).not_to_be_visible()

def test_project_sorting(auth_page_creator: Page, base_url: str, project_creator):
    ProjectFactory.create(name="Alpha Project", creator=project_creator)
    ProjectFactory.create(name="Zeta Project", creator=project_creator)
    ProjectFactory.create(name="Beta Project", creator=project_creator)
    
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="Sort").click()
    page.get_by_label("Sort By").select_option("name")
    page.get_by_label("Order").select_option("asc")
    page.get_by_role("button", name="Apply Sort").click()
    
    cards = page.locator(".project-card-title").all_inner_texts()
    names = [name for name in cards if name in ["Alpha Project", "Beta Project", "Zeta Project"]]
    assert names == ["Alpha Project", "Beta Project", "Zeta Project"]

def test_clearing_filters(auth_page_creator: Page, base_url: str, project_creator):
    p1 = ProjectFactory.create(name="Active Clearing", creator=project_creator)
    p2 = ProjectFactory.create(name="Completed Clearing", creator=project_creator)
    p2.status = "completed"
    p2.save()
    
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="Filter").click()
    page.get_by_label("Status").select_option("completed")
    page.get_by_role("button", name="Apply Filters").click()
    
    expect(page.get_by_text("Active Clearing")).not_to_be_visible()
    
    # Clear filter
    page.get_by_role("button", name="Filter").click()
    page.get_by_role("button", name="Clear").click()
    
    expect(page.get_by_text("Active Clearing")).to_be_visible()

def test_plot_filtering(auth_page_creator: Page, base_url: str, project_creator):
    project = ProjectFactory.create(name="Plot Filter Parent", creator=project_creator)
    PlotFactory.create(project=project, name="Plot Active")
    plot_completed = PlotFactory.create(project=project, name="Plot Completed")
    plot_completed.status = "completed"
    plot_completed.save()
    
    page = auth_page_creator
    page.goto(f"{base_url}/projects/{project.id}")
    
    page.get_by_role("button", name="Filter").click()
    page.get_by_label("Status").select_option("completed")
    page.get_by_role("button", name="Apply Filters").click()
    
    expect(page.get_by_text("Plot Completed")).to_be_visible()
    expect(page.get_by_text("Plot Active")).not_to_be_visible()

def test_pagination_and_sorting(auth_page_creator: Page, base_url: str, project_creator):
    # Create enough to paginate (assuming >10 paginates)
    for i in range(15):
        ProjectFactory.create(name=f"Paginated Proj {i:02d}", creator=project_creator)
    
    page = auth_page_creator
    page.goto(f"{base_url}/projects")
    
    page.get_by_role("button", name="Sort").click()
    page.get_by_label("Sort By").select_option("name")
    page.get_by_label("Order").select_option("asc")
    page.get_by_role("button", name="Apply Sort").click()
    
    # Check page 1
    expect(page.get_by_text("Paginated Proj 00")).to_be_visible()
    
    # Go to next page
    if page.get_by_role("button", name="Next").is_visible():
        page.get_by_role("button", name="Next").click()
        expect(page.get_by_text("Paginated Proj 14")).to_be_visible()
