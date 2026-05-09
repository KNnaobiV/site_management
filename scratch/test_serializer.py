import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hello_world.settings')
django.setup()

from core.models import JobReport
from core.serializers import JobReportSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

try:
    report = JobReport.objects.first()
    if report:
        factory = APIRequestFactory()
        request = factory.get('/')
        # Mock request user if needed
        from core.models import User
        user = User.objects.first()
        request.user = user
        
        serializer = JobReportSerializer(report, context={'request': request, 'role': 'project_manager'})
        print(f"Serialized data: {serializer.data.keys()}")
        if 'days_elapsed' in serializer.data:
            print(f"Success: 'days_elapsed' found in serialized data: {serializer.data['days_elapsed']}")
        else:
            print("Error: 'days_elapsed' NOT found in serialized data.")
    else:
        print("No JobReport found to test with.")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
