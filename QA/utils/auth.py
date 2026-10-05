from playwright.sync_api import Page, expect

def login_user(page: Page, base_url: str, email: str, password: str):
    """Logs in a user through the UI and waits for navigation to the dashboard."""
    page.goto(f"{base_url}/login")
    
    # Fill in credentials
    page.get_by_placeholder("Email address").fill(email)
    page.get_by_placeholder("Password").fill(password)
    
    # Click sign in
    page.get_by_role("button", name="Sign In").click()
    
    # Wait for URL to change to dashboard (/)
    page.wait_for_url(f"{base_url}/")
    
    # Verify the dashboard is loaded by checking for a known element, e.g. the sidebar or welcome text
    expect(page.get_by_text("Dashboard")).to_be_visible()

def logout_user(page: Page, base_url: str):
    """Logs out the user from the sidebar."""
    page.goto(f"{base_url}/")
    page.get_by_role("button", name="Sign Out").click()
    
    # Wait for navigation back to login page
    page.wait_for_url(f"{base_url}/login")
    expect(page.get_by_role("heading", name="Sign in to your account")).to_be_visible()
