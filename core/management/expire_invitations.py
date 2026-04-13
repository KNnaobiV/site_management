from django.core.management.base import BaseCommand
from django.utils import timezone
 
from core.models import ProjectInvitation, SiteInvitation
 
 
class Command(BaseCommand):
    help = "Marks pending invitations past their expiry date as expired."
 
    def handle(self, *args, **options):
        now = timezone.now()
 
        project_count = ProjectInvitation.objects.filter(
            status=ProjectInvitation.Status.PENDING,
            expires_at__lt=now,
        ).update(status=ProjectInvitation.Status.EXPIRED)
 
        site_count = SiteInvitation.objects.filter(
            status=SiteInvitation.Status.PENDING,
            expires_at__lt=now,
        ).update(status=SiteInvitation.Status.EXPIRED)
 
        self.stdout.write(
            self.style.SUCCESS(
                f"Expired {project_count} project invitation(s) "
                f"and {site_count} site invitation(s)."
            )
        )