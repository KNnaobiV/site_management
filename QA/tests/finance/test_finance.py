import pytest
from playwright.sync_api import Page, expect
from utils.factories import ProjectFactory, PlotFactory, WorkFactory, JobFactory
from backend.core.models import Expense

pytestmark = pytest.mark.finance

@pytest.fixture
def finance_job(project_creator):
    project = ProjectFactory.create(name="Finance Project", creator=project_creator, budget=100000)
    plot = PlotFactory.create(project=project, name="Finance Plot", budget=50000)
    work = WorkFactory.create(plot=plot, name="Finance Work", budget=25000)
    return JobFactory.create(work=work, name="Finance Job", budget=10000)

def test_expense_below_budget(auth_page_creator: Page, base_url: str, finance_job):
    page = auth_page_creator
    page.goto(f"{base_url}/jobs/{finance_job.id}")
    
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("3000")
    page.get_by_label("Description").fill("Materials")
    page.get_by_role("button", name="Save Expense").click()
    
    expect(page.get_by_text("₦ 3,000.00")).to_be_visible()
    
    expense = Expense.objects.filter(job_item=finance_job).first()
    assert expense is not None
    assert float(expense.amount) == 3000.00
    
    expect(page.get_by_text("Remaining: ₦ 7,000.00")).to_be_visible()

def test_multiple_expenses_below_budget(auth_page_creator: Page, base_url: str, finance_job):
    page = auth_page_creator
    page.goto(f"{base_url}/jobs/{finance_job.id}")
    
    # Expense 1
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("2000")
    page.get_by_label("Description").fill("Materials 1")
    page.get_by_role("button", name="Save Expense").click()
    
    # Expense 2
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("4000")
    page.get_by_label("Description").fill("Materials 2")
    page.get_by_role("button", name="Save Expense").click()
    
    # Check total spent
    expect(page.get_by_text("Total Expenses: ₦ 6,000.00")).to_be_visible()
    expect(page.get_by_text("Remaining: ₦ 4,000.00")).to_be_visible()
    expect(page.get_by_text("60%")).to_be_visible()

def test_expense_exceeding_budget(auth_page_creator: Page, base_url: str, finance_job):
    page = auth_page_creator
    page.goto(f"{base_url}/jobs/{finance_job.id}")
    
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("12000")
    page.get_by_label("Description").fill("Expensive Materials")
    page.get_by_role("button", name="Save Expense").click()
    
    expect(page.locator(".over-budget-warning")).to_be_visible()
    expect(page.get_by_text("120%")).to_be_visible()

def test_cumulative_expenses_exceeding_budget(auth_page_creator: Page, base_url: str, finance_job):
    page = auth_page_creator
    page.goto(f"{base_url}/jobs/{finance_job.id}")
    
    # Expense 1 (below budget)
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("8000")
    page.get_by_label("Description").fill("Materials 1")
    page.get_by_role("button", name="Save Expense").click()
    
    # Expense 2 (pushes it over budget)
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("3000")
    page.get_by_label("Description").fill("Materials 2")
    page.get_by_role("button", name="Save Expense").click()
    
    expect(page.locator(".over-budget-warning")).to_be_visible()
    expect(page.get_by_text("110%")).to_be_visible()
    expect(page.get_by_text("Total Expenses: ₦ 11,000.00")).to_be_visible()
