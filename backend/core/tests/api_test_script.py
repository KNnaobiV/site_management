import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test.client import Client
from django.contrib.auth import get_user_model
User = get_user_model()
c = Client()
u = User.objects.get(username='testuser')
c.force_login(u)
res = c.get('/api/projects/')
print("Status:", res.status_code)
print("Content:", res.json())
