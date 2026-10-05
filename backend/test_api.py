import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "site_base.settings.dev")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
import traceback

User = get_user_model()
user = User.objects.first()
client = APIClient(HTTP_HOST='localhost')
client.force_authenticate(user=user)

try:
    response = client.get('/api/projects/')
    print('STATUS:', response.status_code)
    if response.status_code == 200:
        print('CONTENT:', response.json())
    else:
        print('CONTENT:', response.content.decode()[:500])
except Exception as e:
    traceback.print_exc()
