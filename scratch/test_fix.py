import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hello_world.settings')
django.setup()

from core.models import JobReport, JobItem, User
from django.utils import timezone
from datetime import date

try:
    # Try to find an existing job item or create a dummy one
    job_item = JobItem.objects.first()
    user = User.objects.first()
    
    if job_item and user:
        print(f"Testing save for JobItem: {job_item.id}")
        report = JobReport(
            job_item=job_item,
            reported_by=user,
            report_date=date.today(),
            percentage_job_progress=50,
            expected_completion_date=date.today(),
            notes="Test report"
        )
        # This should NOT raise AttributeError now
        report.save()
        print("Success: JobReport saved without error.")
        print(f"Days elapsed: {report.days_elapsed}")
        # Clean up
        report.delete()
    else:
        print("No JobItem or User found to test with.")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
