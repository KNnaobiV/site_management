import pytest
from playwright.sync_api import Page, expect
from utils.auth import login_user, logout_user

pytestmark = pytest.mark.auth

def test_successful_login(page: Page, base_url: str, project_creator):
    """Test successful login with valid credentials."""
    login_user(page, base_url, project_creator.email, "Password123!")
    
    # Assert dashboard elements
    expect(page.get_by_text("Dashboard")).to_be_visible()

def test_invalid_credentials(page: Page, base_url: str):
    """Test login with invalid credentials."""
    page.goto(f"{base_url}/login")
    page.get_by_placeholder("Email address").fill("nonexistent@example.com")
    page.get_by_placeholder("Password").fill("WrongPass123!")
    page.get_by_role("button", name="Sign In").click()
    
    # Assert error message
    expect(page.get_by_text("No active account found with the given credentials")).to_be_visible()
    # Verify we are still on the login page
    expect(page.get_by_role("heading", name="Sign in to your account")).to_be_visible()

def test_missing_login_fields(page: Page, base_url: str):
    """Test login with missing fields."""
    page.goto(f"{base_url}/login")
    # Click without filling anything
    page.get_by_role("button", name="Sign In").click()
    
    # Assert required field validation (HTML5 native validation or custom)
    email_input = page.get_by_placeholder("Email address")
    
    # Playwright evaluates the HTML5 validation message
    is_valid = email_input.evaluate("el => el.validity.valid")
    assert not is_valid, "Form submitted despite empty required fields"

def test_logout(page: Page, base_url: str, project_creator):
    """Test logout flow."""
    login_user(page, base_url, project_creator.email, "Password123!")
    logout_user(page, base_url)

def test_access_protected_page_after_logout(page: Page, base_url: str, project_creator):
    """Test accessing protected route without auth redirects to login."""
    login_user(page, base_url, project_creator.email, "Password123!")
    logout_user(page, base_url)
    
    # Attempt to go to a protected route directly
    page.goto(f"{base_url}/projects")
    
    # Assert redirected back to login
    page.wait_for_url(f"**/*login*")
    expect(page.get_by_role("heading", name="Sign in to your account")).to_be_visible()
