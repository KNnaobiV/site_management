import requests
import sys
import os
import django

# Setup Django to use its models
sys.path.append('c:/Users/Chike/Ekene/site_management/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import ConstructionProject, ConstructionPlot

User = get_user_model()

# 1. Find a project manager and a plot
pm = User.objects.filter(project_manager_projects__isnull=False).first()
if not pm:
    print("No project manager found.")
    sys.exit(1)

project = pm.project_manager_projects.first()
plot = project.plots.first()

if not plot:
    print("No plot found for this project.")
    sys.exit(1)

# Ensure there is a foreman to remove
foreman = plot.foremen.first()
if not foreman:
    # Just grab another user and make them a foreman
    foreman = User.objects.exclude(pk=pm.pk).first()
    plot.foremen.add(foreman)

print(f"PM: {pm.username}")
print(f"Plot: {plot.id}")
print(f"Foreman to remove: {foreman.username}")

# Generate a token for the PM
# We don't have the password, so let's just use DRF token or force authentication in a test client
from rest_framework.test import APIClient
client = APIClient()
client.force_authenticate(user=pm)

# 2. Make the request to remove the foreman
url = f"/api/projects/{project.id}/plots/{plot.id}/remove-user/"
print(f"POST {url}")
response = client.post(url, {"username": foreman.username}, format="json")
print("Response Status:", response.status_code)
print("Response Data:", response.data)

# Test the flat URL too
url_flat = f"/api/plots/{plot.id}/remove-user/"
print(f"POST {url_flat}")
response = client.post(url_flat, {"username": foreman.username}, format="json")
print("Response Status:", response.status_code)
print("Response Data:", response.data)
