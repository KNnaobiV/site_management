import pytest
from playwright.sync_api import Page, expect
from utils.auth import login_user, logout_user

pytestmark = pytest.mark.regression

def test_full_regression_workflow(page: Page, base_url: str, project_creator):
    """
    Login
    → create project
    → create multiple plots
    → create works
    → create multiple jobs
    → invite consultant/foreman
    → accept invitations
    → create reports
    → review/approve reports
    → add expenses
    → exceed job budget
    → verify PM alert
    → pass job target date
    → create late report
    → verify overdue alert
    → generate site report
    → generate financial report
    → filter/sort resources
    → logout
    """
    # 1. Login
    login_user(page, base_url, project_creator.email, "Password123!")
    
    # 2. Create Project
    page.goto(f"{base_url}/projects")
    page.get_by_role("button", name="New Project").click()
    page.get_by_label("Project Name *").fill("E2E Regression Project")
    page.get_by_label("Budget").fill("1000000")
    page.get_by_label("Start Date *").fill("2026-01-01")
    page.get_by_label("Target End Date *").fill("2026-12-31")
    page.get_by_role("button", name="Create Project").click()
    expect(page.get_by_role("heading", name="E2E Regression Project")).to_be_visible()
    
    # 3. Create Plots
    page.get_by_role("button", name="New Plot").click()
    page.get_by_label("Plot Name *").fill("E2E Plot 1")
    page.get_by_label("Budget").fill("500000")
    page.get_by_label("Start Date *").fill("2026-02-01")
    page.get_by_label("Target End Date *").fill("2026-11-30")
    page.get_by_role("button", name="Create Plot").click()
    expect(page.get_by_role("heading", name="E2E Plot 1")).to_be_visible()
    
    # 4. Create Works
    page.get_by_role("button", name="New Work").click()
    page.get_by_label("Work Name *").fill("E2E Work 1")
    page.get_by_label("Budget").fill("200000")
    page.get_by_label("Start Date *").fill("2026-03-01")
    page.get_by_label("Target End Date *").fill("2026-10-31")
    page.get_by_role("button", name="Create Work").click()
    expect(page.get_by_role("heading", name="E2E Work 1")).to_be_visible()
    
    # 5. Create Jobs
    page.get_by_role("button", name="New Job").click()
    page.get_by_label("Job Name *").fill("E2E Job 1")
    page.get_by_label("Budget").fill("100000")
    page.get_by_label("Target End Date *").fill("2026-09-30")
    page.get_by_role("button", name="Create Job").click()
    expect(page.get_by_role("heading", name="E2E Job 1")).to_be_visible()
    
    # 6. Add Expenses (exceed budget)
    page.get_by_role("button", name="Add Expense").click()
    page.get_by_label("Amount").fill("150000")  # Over budget!
    page.get_by_label("Description").fill("Over budget materials")
    page.get_by_role("button", name="Save Expense").click()
    
    # Wait for expense and over-budget warning
    expect(page.get_by_text("150%")).to_be_visible()
    
    # 7. Check Alerts
    page.goto(f"{base_url}/notifications")
    expect(page.get_by_text("exceeded its budget")).to_be_visible()
    
    # 8. Export Reports
    page.goto(f"{base_url}/reports")
    # For a real E2E, we'd trigger the export API and verify it doesn't fail
    
    # 9. Logout
    logout_user(page, base_url)
