import os
import sys
import pytest

# Setup Django before importing models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'site_base.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from utils.factories import UserFactory, ProjectFactory, PlotFactory, WorkFactory, JobFactory

User = get_user_model()

# ==========================================
# Fixtures for Playwright & URLs
# ==========================================

@pytest.fixture(scope="session")
def base_url():
    """URL of the frontend dev server."""
    return os.getenv("BASE_URL", "http://localhost:5173")


# ==========================================
# Database cleanup / Isolation
# ==========================================

@pytest.fixture(autouse=True)
def clean_db():
    """
    Clean up specific records created during tests instead of 
    re-creating the entire DB, since it's a shared dev DB.
    Alternatively, could use pytest-django's db fixtures.
    """
    yield
    # We rely on unique names/emails per test rather than 
    # aggressively wiping the DB, to avoid breaking the local dev environment.


# ==========================================
# User Fixtures
# ==========================================

@pytest.fixture
def project_creator():
    """A user who creates projects."""
    user = UserFactory.create(username="qa_creator", email="qa_creator@example.com")
    yield user
    user.delete()

@pytest.fixture
def project_manager():
    """A user designated as a PM."""
    user = UserFactory.create(username="qa_pm", email="qa_pm@example.com")
    yield user
    user.delete()

@pytest.fixture
def consultant():
    """A user designated as a consultant."""
    user = UserFactory.create(username="qa_consultant", email="qa_consultant@example.com")
    yield user
    user.delete()

@pytest.fixture
def foreman():
    """A user designated as a foreman."""
    user = UserFactory.create(username="qa_foreman", email="qa_foreman@example.com")
    yield user
    user.delete()

@pytest.fixture
def unrelated_user():
    """A completely unrelated user."""
    user = UserFactory.create(username="qa_unrelated", email="qa_unrelated@example.com")
    yield user
    user.delete()


# ==========================================
# Authenticated Browser Contexts
# ==========================================
# For tests that do not need to test the login flow itself.

@pytest.fixture
def auth_page_creator(page, base_url, project_creator):
    """Returns a page already logged in as the project creator."""
    from utils.auth import login_user
    login_user(page, base_url, project_creator.email, "Password123!")
    return page

@pytest.fixture
def auth_page_pm(page, base_url, project_manager):
    """Returns a page already logged in as the project manager."""
    from utils.auth import login_user
    login_user(page, base_url, project_manager.email, "Password123!")
    return page

@pytest.fixture
def auth_page_foreman(page, base_url, foreman):
    """Returns a page already logged in as the foreman."""
    from utils.auth import login_user
    login_user(page, base_url, foreman.email, "Password123!")
    return page

@pytest.fixture
def auth_page_unrelated(page, base_url, unrelated_user):
    """Returns a page already logged in as an unrelated user."""
    from utils.auth import login_user
    login_user(page, base_url, unrelated_user.email, "Password123!")
    return page
