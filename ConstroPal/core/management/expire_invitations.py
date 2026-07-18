from django.core.management.base import BaseCommand
from django.utils import timezone
 
from core.models import ProjectInvitation, PlotInvitation
 
 
class Command(BaseCommand):
    help = "Marks pending invitations past their expiry date as expired."
 
    def handle(self, *args, **options):
        now = timezone.now()
 
        project_count = ProjectInvitation.objects.filter(
            status="pending",
            expires_at__lt=now,
        ).update(status="expired")
 
        plot_count = PlotInvitation.objects.filter(
            status="pending",
            expires_at__lt=now,
        ).update(status="expired")
 
        self.stdout.write(
            self.style.SUCCESS(
                f"Expired {project_count} project invitation(s) "
                f"and {plot_count} plot invitation(s)."
            )
        )