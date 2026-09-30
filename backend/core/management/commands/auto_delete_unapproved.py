import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import JobItem, Notification

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Auto-delete unapproved JobItems after 10 days and send warnings at 7, 8, 9, and 9.5 days."

    def handle(self, *args, **kwargs):
        now = timezone.now()
        # Find all unapproved job items
        unapproved_jobs = JobItem.objects.filter(is_approved=False)

        deleted_count = 0
        warning_count = 0

        for job in unapproved_jobs:
            # Calculate age in hours
            age_delta = now - job.created_at
            hours_old = age_delta.total_seconds() / 3600.0

            # Find the relevant PMs and Creator
            users_to_notify = set()
            if job.created_by:
                users_to_notify.add(job.created_by)
            
            # Add PM/Project Creator
            project = job.work_item.construction_plot.construction_project
            if project.created_by:
                users_to_notify.add(project.created_by)
            
            # Find Project Manager for the project
            if hasattr(project, 'project_manager') and project.project_manager:
                users_to_notify.add(project.project_manager)

            # Determine action based on age
            # Note: This script assumes it runs every 12 hours.
            if hours_old >= 240:
                # Delete the job
                job_name = job.job_name
                job.delete()
                deleted_count += 1
                
                # Notify that it was deleted
                for u in users_to_notify:
                    Notification.objects.create(
                        user=u,
                        project=project,
                        message=f"Job item '{job_name}' was automatically deleted because it remained unapproved for 10 days.",
                        priority=Notification.Priority.HIGH
                    )
            elif 228 <= hours_old < 240:
                self.send_warnings(users_to_notify, project, job, "12 hours")
                warning_count += 1
            elif 216 <= hours_old < 228:
                self.send_warnings(users_to_notify, project, job, "1 day")
                warning_count += 1
            elif 192 <= hours_old < 204:
                self.send_warnings(users_to_notify, project, job, "2 days")
                warning_count += 1
            elif 168 <= hours_old < 180:
                self.send_warnings(users_to_notify, project, job, "3 days")
                warning_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully deleted {deleted_count} jobs and sent {warning_count} warnings."))

    def send_warnings(self, users_to_notify, project, job, time_left):
        for u in users_to_notify:
            Notification.objects.create(
                user=u,
                project=project,
                message=f"URGENT: Job item '{job.job_name}' has not been approved and will be automatically deleted in {time_left}.",
                priority=Notification.Priority.URGENT,
                target_url=f"/job-items/{job.pk}/"
            )
