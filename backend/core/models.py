import uuid

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta, date
from django.core.files.uploadedfile import UploadedFile
from django.core.files.base import ContentFile
import sys
from io import BytesIO
from PIL import Image

from base.models import Picture, Video
from .groups import create_company_group, create_project_group
# Create your models here.

User = get_user_model()


class TimestampedModel(models.Model):
    """Abstract base model with created_at and updated_at timestamps."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class StatusChoices(models.TextChoices):
        PLANNED = "Planned"
        IN_PROGRESS = "In Progress"
        COMPLETED = "Completed"
        ON_HOLD = "On Hold"
        DELAYED = "Delayed"
        CANCELLED = "Cancelled"


class ProjectRole(models.TextChoices):
    PROJECT_MANAGER = "project_manager", "Project Manager"
    CLIENT = "client", "Client"
    CONSULTANT = "consultant", "Consultant"


class PlotRole(models.TextChoices):
    FOREMAN = "foreman", "Foreman"
    STOREKEEPER = "storekeeper", "Storekeeper"


_PROJECT_ROLE_GROUP_SUFFIX = {
    ProjectRole.CLIENT: "Client",
    ProjectRole.PROJECT_MANAGER: "Project Manager",
    ProjectRole.CONSULTANT: "Consultant",
}

def _add_user_to_project_group(user, project_name, role):
    suffix = _PROJECT_ROLE_GROUP_SUFFIX.get(role)
    if not suffix:
        return
    group_name = f"{project_name} {suffix}"
    group, _ = Group.objects.get_or_create(name=group_name)
    group.user_set.add(user)


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"
    REVOKED = "revoked", "Revoked"
    EXPIRED = "expired", "Expired"


class ConstructionProject(TimestampedModel):
    """
    Represents a construction project with associated client 
    and project manager
    """
    created_by = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="created_projects"
    )
    client = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="project_owner",
        null=True, blank=True
    )
    project_manager = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="project_manager",
        null=True, blank=True
    )
    consultants = models.ManyToManyField(
        User, related_name="project_consultants", blank=True
    )
    project_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    is_deleted = models.BooleanField(default=False)
    project_name = models.CharField(max_length=100, default="")
    project_description = models.TextField(default="")
    start_date = models.DateField(default=date.today)
    target_end_date = models.DateField(default=date.today)
    number_of_plots = models.PositiveSmallIntegerField(default=1)
    default_upload_to = "projects/covers/"
    cover_image = models.ForeignKey(
        Picture,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="project_covers"
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    target_end_date__gte=models.F('start_date')
                ),
                name='project_target_end_date_after_start_date'
            ),
            models.UniqueConstraint(
                fields=['created_by', 'project_name'], name='unique_project_name'
            ),
        ]

    def __init__(self, *args, upload_to=None, **kwargs):
        self.upload_to = upload_to or self.default_upload_to
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        self._pending_cover_image = None
        if 'cover_image' in kwargs:
            raw_cover = kwargs.get('cover_image')
            if raw_cover is not None and isinstance(raw_cover, (UploadedFile, File)):
                self._pending_cover_image = kwargs.pop('cover_image')
        super().__init__(*args, **kwargs)

    def save(self, *args, **kwargs):
        if self.target_end_date and self.start_date and \
                self.target_end_date < self.start_date:
            raise ValueError("Project target end date cannot be before start date.")
        if not self.project_name:
            client_name = self.client.username if self.client else "Unknown Client"
            pm_name = self.project_manager.username if self.project_manager else "Unknown PM"
            self.project_name = f"Project for {client_name} with {pm_name}"

        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        target_upload_to = getattr(self, 'upload_to', self.default_upload_to)
        file_to_process = getattr(self, '_pending_cover_image', None)
        if file_to_process:
            try:
                img = Image.open(file_to_process)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                output = BytesIO()
                img.save(output, format='JPEG', quality=75)
                output.seek(0)
                file_name = f"{getattr(file_to_process, 'name', 'cover').split('.')[0]}.jpg"
                processed_file = ContentFile(output.read(), name=file_name)
            except Exception:
                processed_file = file_to_process

            self.cover_image = Picture.objects.create(
                img=processed_file,
                upload_to=target_upload_to
            )
            self._pending_cover_image = None
        elif isinstance(self.cover_image, Picture) and not self.cover_image.pk:
            if getattr(self, 'upload_to', None):
                self.cover_image.upload_to = self.upload_to
            self.cover_image.save()

        super().save(*args, **kwargs)

    @receiver(post_save, sender='core.ConstructionProject')
    def create_project_group(sender, instance, created, **kwargs):
        """Create project-specific groups when a new project is created"""
        group_suffixes = [
            "Client", "Consultant", "Project Manager",
        ]
        if created:
            for suffix in group_suffixes:
                create_project_group(instance.project_name, group_suffix=suffix)


class ProjectInvitation(TimestampedModel):
    """Invitation for a user to join a ConstructionProject with a specific role.
    Only the project owner (client field) or created_by user can send these.
    On acceptance, the invitee is assigned to the correct FK/M2M field
    and added to the corresponding Django permission group.
    """
    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="sent_project_invitations"
    )
    invitee = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="received_project_invitations"
    )
    role = models.CharField(max_length=20, choices=ProjectRole.choices)
    token = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    status = models.CharField(
        max_length=20, choices=InvitationStatus.choices, 
        default=InvitationStatus.PENDING
    )
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)
    message = models.TextField(blank=True)

    class Meta:
        verbose_name = "Project Invitation"
        verbose_name_plural = "Project Invitations"
        constraints = [
            # One active invitation per invitee+project+role at a time
            models.UniqueConstraint(
                fields=["project", "invitee", "role"],
                condition=models.Q(status="pending"),
                name="unique_pending_project_invitation",
            )
        ]
 
    def __str__(self):
        return (
            f"{self.invitee.username} invited as {self.role} "
            f"on {self.project.project_name}"
        )

    @property
    def target_url(self):
        return f"/invitations/projects/{self.pk}/"
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return self.status == InvitationStatus.PENDING and \
            timezone.now() > self.expires_at
 
    @property
    def is_actionable(self) -> bool:
        """True if the invitee can still accept or decline."""
        return self.status == InvitationStatus.PENDING and not self.is_expired
 
    def accept(self):
        if not self.is_actionable:
            raise ValueError(
                f"Invitation cannot be accepted (status={self.status}, "
                f"expired={self.is_expired})."
            )
 
        project = self.project

        if self.role == ProjectRole.CLIENT:
            project.client = self.invitee
 
        elif self.role == ProjectRole.PROJECT_MANAGER:
            project.project_manager = self.invitee
 
        elif self.role == ProjectRole.CONSULTANT:
            project.consultants.add(self.invitee)
 
        else:
            raise ValueError(f"Unknown project role: {self.role}")
        
        project.save()
        _add_user_to_project_group(self.invitee, project.project_name, self.role)
 
        self.status = InvitationStatus.ACCEPTED
        self.responded_at = timezone.now()
        self.save()

    def decline(self):
        if not self.is_actionable:
            raise ValueError(
                f"Invitation cannot be declined (status={self.status})."
            )
        self.status = InvitationStatus.DECLINED
        self.responded_at = timezone.now()
        self.save()
 
    def revoke(self):
        """Called by the inviter to cancel a pending invitation."""
        if self.status != InvitationStatus.PENDING:
            raise ValueError("Only pending invitations can be revoked.")
        self.status = InvitationStatus.REVOKED
        self.save()
 

class PlotInvitation(TimestampedModel):
    """
    Invitation for a user to join a ConstructionPlot as Foreman or Storekeeper.
    On acceptance the invitee is set on the relevant FK field and added to
    the plot's permission group.
    """
 
    # Relationships
    plot = models.ForeignKey(
        "core.ConstructionPlot",
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_plot_invitations",
    )
    invitee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_plot_invitations",
    )
 
    # Role being offered
    role = models.CharField(max_length=20, choices=PlotRole.choices)
 
    # Tracking
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(
        max_length=20, 
        choices=InvitationStatus.choices, 
        default=InvitationStatus.PENDING
    )
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)
    message = models.TextField(blank=True)
 
    class Meta:
        verbose_name = "Plot Invitation"
        verbose_name_plural = "Plot Invitations"
        constraints = [
            models.UniqueConstraint(
                fields=["plot", "invitee", "role"],
                condition=models.Q(status="pending"),
                name="unique_pending_plot_invitation",
            )
        ]
 
    def __str__(self):
        return (
            f"{self.invitee.username} invited as {self.role} "
            f"on plot {self.plot.address}"
        )

    @property
    def target_url(self):
        return f"/invitations/plots/{self.pk}/"
 
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)
 
    @property
    def is_expired(self) -> bool:
        return self.status == InvitationStatus.PENDING and \
            timezone.now() > self.expires_at
 
    @property
    def is_actionable(self) -> bool:
        return self.status == InvitationStatus.PENDING and not self.is_expired
 
    def accept(self):
        if not self.is_actionable:
            raise ValueError(
                f"Invitation cannot be accepted (status={self.status}, "
                f"expired={self.is_expired})."
            )
 
        plot = self.plot
 
        if self.role == PlotRole.FOREMAN:
            plot.foreman = self.invitee
            plot.save()
            plot.add_foreman_to_group()
 
        elif self.role == PlotRole.STOREKEEPER:
            plot.storekeeper = self.invitee
            plot.save()
            plot.add_storekeeper_to_group()
 
        else:
            raise ValueError(f"Unknown plot role: {self.role}")
 
        self.status = InvitationStatus.ACCEPTED
        self.responded_at = timezone.now()
        self.save()
 
    def decline(self):
        if not self.is_actionable:
            raise ValueError(
                f"Invitation cannot be declined (status={self.status})."
            )
        self.status = InvitationStatus.DECLINED
        self.responded_at = timezone.now()
        self.save()
 
    def revoke(self):
        if self.status != InvitationStatus.PENDING:
            raise ValueError("Only pending invitations can be revoked.")
        self.status = InvitationStatus.REVOKED
        self.save()


class ConstructionPlot(TimestampedModel):
    construction_project = models.ForeignKey(
        ConstructionProject, on_delete=models.CASCADE
    )    
    foreman = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="plot_foreman",
        null=True, blank=True
    )
    storekeeper = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="plot_storekeeper",
        null=True, blank=True
    )
    address = models.CharField(max_length=255)
    plot_number = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    start_date = models.DateField(default=date.today)
    target_end_date = models.DateField(default=date.today)
    gps_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    gps_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    notes = models.TextField(blank=True, default="")

    def save(self, *args, **kwargs):
        if not self.address:
            raise ValueError("Construction plot must have an address.")
        if self.target_end_date and self.start_date and self.target_end_date < self.start_date:
            raise ValueError("Plot target end date cannot be before start date.")
        super().save(*args, **kwargs)
    
    @receiver(post_save, sender='core.ConstructionPlot')
    def create_plot_groups(sender, instance, created, **kwargs):
        """Create plot-specific groups when a new construction plot is created"""
        group_suffixes = ["Foreman", "Storekeeper"]
        if created:
            for suffix in group_suffixes:
                create_project_group(
                    instance.construction_project.project_name, 
                    group_suffix=suffix
                )
    
    def add_foreman_to_group(self):
        foreman_group_name = f"{self.construction_project.project_name} Foreman"
        foreman_group, _ = Group.objects.get_or_create(name=foreman_group_name)
        foreman_group.user_set.add(self.foreman)
    
    def add_storekeeper_to_group(self):
        storekeeper_group_name = f"{self.construction_project.project_name} Storekeeper"
        storekeeper_group, _ = Group.objects.get_or_create(name=storekeeper_group_name)
        storekeeper_group.user_set.add(self.storekeeper)


class WorkItem(TimestampedModel):
    """
    Represents a specific work item or phase of construction at a plot
    """
    construction_plot = models.ForeignKey(
        ConstructionPlot, on_delete=models.CASCADE
    )
    work_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    name = models.CharField(max_length=100, default="")
    is_approved = models.BooleanField(default=False)
    description = models.TextField(default="")
    start_date = models.DateField(default=date.today)
    target_end_date = models.DateField(default=date.today)
    # Checklist: [{"text": "Pour footings", "done": false}, ...]
    checklist = models.JSONField(default=list, blank=True)
    default_upload_to = "work_items/%Y/%m/%d/"
    work_item_image = models.ForeignKey(
        Picture,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="work_item_pictures"
    )

    class Meta:
        ordering = ['-updated_at']

    def __init__(self, *args, upload_to=None, **kwargs):
        self.upload_to = upload_to or self.default_upload_to
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        self._pending_work_item_image = None
        if 'work_item_image' in kwargs:
            raw_img = kwargs.get('work_item_image')
            if raw_img is not None and isinstance(raw_img, (UploadedFile, File)):
                self._pending_work_item_image = kwargs.pop('work_item_image')
        super().__init__(*args, **kwargs)

    def save(self, *args, **kwargs):
        if (
            self.target_end_date and self.start_date and 
            self.target_end_date < self.start_date
        ):
            raise ValueError(
                "Target end date cannot be before start date."
            )
        if not self.name:
            raise ValueError("Work item must have a name.")

        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        target_upload_to = getattr(self, 'upload_to', self.default_upload_to)
        if getattr(self, '_pending_work_item_image', None):
            self.work_item_image = Picture.objects.create(
                img=self._pending_work_item_image,
                upload_to=target_upload_to
            )
            self._pending_work_item_image = None
        elif isinstance(self.work_item_image, Picture) and not self.work_item_image.pk:
            if getattr(self, 'upload_to', None):
                self.work_item_image.upload_to = self.upload_to
            self.work_item_image.save()

        super().save(*args, **kwargs)


class JobItem(TimestampedModel):
    """
    Represents a specific job or task to be performed at a construction plot
    Each job item is associated with a work item and can have multiple
    material needs and a specific artisan assigned to it.    
    """
    class Artisans(models.TextChoices):
        MASON = "Mason"
        PLUMBER = "Plumber"
        ELECTRICIAN = "Electrician"
        CARPENTER = "Carpenter"
        PAINTER = "Painter"
        ROOFER = "Roofer"
        IRON_BENDER = "Iron Bender"
        TILER = "Tiler"
        GLASS_WORKER = "Glass Worker"
        ALUMINIUM_WORKER = "Aluminium Worker"
        OTHER = "Other"

    class PriorityChoices(models.TextChoices):
        LOW = "Low"
        MEDIUM = "Medium"
        HIGH = "High"
        URGENT = "Urgent"

    work_item = models.ForeignKey(
        WorkItem, on_delete=models.CASCADE, related_name="job_items"
    )
    job_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    job_artisan = models.CharField(max_length=20, choices=Artisans.choices)
    job_name = models.CharField(max_length=50, default="")
    is_approved = models.BooleanField(default=False)
    priority = models.CharField(
        max_length=20, choices=PriorityChoices.choices, default=PriorityChoices.MEDIUM
    )
    job_description = models.TextField(default="")
    start_date = models.DateField(default=date.today)
    target_end_date = models.DateField(default=date.today)
    estimated_hours = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True
    )

    class Meta:
        ordering = ['-updated_at']

    def save(self, *args, **kwargs):
        if (
            self.target_end_date and self.start_date and 
            self.target_end_date < self.start_date
        ):
            raise ValueError(
                "Target end date cannot be before start date."
            )
        if not self.job_name:
            self.job_name = f"{self.job_artisan} work for {self.work_item.name}"
        if not self.job_description:
            self.job_description = (
                f"{self.job_name} for {self.work_item.name} by {self.job_artisan}"
            )
        super().save(*args, **kwargs)


class JobReport(TimestampedModel):
    """Daily construction plot report tracking work progress and materials"""

    class ReportStatusChoices(models.TextChoices):
        submitted = "Submitted"
        approved = "Approved"
        rejected = "Rejected"

    class PriorityChoices(models.TextChoices):
        NORMAL = "Normal"
        URGENT = "Urgent"
        CRITICAL = "Critical"

    default_upload_to = "reports/%Y/%m/%d/"
    job_item = models.ForeignKey(
        JobItem, on_delete=models.CASCADE, related_name="daily_reports"
    )
    job_image = models.ForeignKey(
        Picture, 
        on_delete=models.CASCADE, 
        related_name="job_report_pictures",
        blank=True, null=True
    )
    job_video = models.ForeignKey(
        Video, 
        on_delete=models.CASCADE, 
        related_name="job_report_videos",
        blank=True, null=True
    )
    reported_by = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    # Report metadata
    report_status = models.CharField(
        max_length=20, choices=ReportStatusChoices.choices, 
        default=ReportStatusChoices.submitted
    )
    priority = models.CharField(
        max_length=10, choices=PriorityChoices.choices,
        default=PriorityChoices.NORMAL
    )
    report_date = models.DateField(default=timezone.now)
    percentage_job_progress = models.PositiveSmallIntegerField()
    # Scheduling
    expected_completion_date = models.DateField(
        help_text="When this phase of work is expected to be completed"
    )
    issues_encountered = models.TextField(
        blank=True, help_text="Describe any issues or obstacles encountered"
    )
    notes = models.TextField(
        blank=True, help_text="Additional notes or observations"
    )
    internal_comments = models.TextField(
        blank=True, help_text="Internal comments for project team"
    )
    external_comments = models.TextField(
        blank=True, help_text="Comments visible to client and consultants"
    )
    
    class Meta:
        ordering = ['-updated_at']
        verbose_name = "Daily Job Report"
        verbose_name_plural = "Daily Job Reports"
    
    def __init__(self, *args, upload_to=None, **kwargs):
        self.upload_to = upload_to or self.default_upload_to
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        self._pending_job_image = None
        if 'job_image' in kwargs:
            raw_img = kwargs.get('job_image')
            if raw_img is not None and isinstance(raw_img, (UploadedFile, File)):
                self._pending_job_image = kwargs.pop('job_image')
        super().__init__(*args, **kwargs)

    def __str__(self):
        return (f"{self.job_item.job_name.title()} for "
                f"{self.job_item.work_item.name} - {self.report_date}"
            )
    
    @property
    def days_elapsed(self):
        """Calculate days elapsed since the job item started"""
        start = getattr(self.job_item, 'actual_start_date', None) or getattr(self.job_item, 'start_date', None)
        report_dt = self.report_date.date() if hasattr(self.report_date, 'date') else self.report_date
        start_dt = start.date() if hasattr(start, 'date') else start
        if start_dt and report_dt:
            return (report_dt - start_dt).days
        return 0
    
    def save(self, *args, **kwargs):
        """Calculate days elapsed when saving"""
        start = getattr(self.job_item, 'actual_start_date', None) or getattr(self.job_item, 'start_date', None)
        report_dt = self.report_date.date() if hasattr(self.report_date, 'date') else self.report_date
        start_dt = start.date() if hasattr(start, 'date') else start
        if (
            start_dt and report_dt and \
            report_dt < start_dt
            ):
            raise ValueError(
                "Report date cannot be before job item start date."
            )

        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        target_upload_to = getattr(self, 'upload_to', self.default_upload_to)
        if getattr(self, '_pending_job_image', None):
            self.job_image = Picture.objects.create(
                img=self._pending_job_image,
                upload_to=target_upload_to
            )
            self._pending_job_image = None
        elif isinstance(self.job_image, Picture) and not self.job_image.pk:
            if getattr(self, 'upload_to', None):
                self.job_image.upload_to = self.upload_to
            self.job_image.save()
        
        super().save(*args, **kwargs)


class Notification(models.Model):
    class Priority(models.TextChoices):
        LOW = "Low"
        NORMAL = "Normal"
        HIGH = "High"
        URGENT = "Urgent"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="notifications")
    message = models.TextField()
    # Optional SPA route or URL that the frontend can navigate to
    target_url = models.CharField(max_length=512, null=True, blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.priority}] Notification for {self.user.username}: {self.message[:30]}..."


class JobReportComment(models.Model):
    report = models.ForeignKey(JobReport, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, related_name='replies',
        null=True, blank=True
    )

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.user.username} on {self.report}"


# Backwards-compat alias so existing migrations don't break before re-running them
ConstructionSite = ConstructionPlot
SiteRole = PlotRole
SiteInvitation = PlotInvitation


@receiver(post_save, sender=ProjectInvitation)
def create_project_invitation_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.invitee,
            project=instance.project,
            message=f"You have been invited to join project '{instance.project.project_name}' as {instance.role}.",
            target_url=instance.target_url,
            priority=Notification.Priority.HIGH
        )

@receiver(post_save, sender=PlotInvitation)
def create_plot_invitation_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.invitee,
            project=instance.plot.construction_project,
            message=f"You have been invited to join plot '{instance.plot.address}' as {instance.role}.",
            target_url=instance.target_url,
            priority=Notification.Priority.HIGH
        )


class Document(TimestampedModel):
    """
    Documents uploaded for a project or specific plot.
    """
    project = models.ForeignKey(
        ConstructionProject, on_delete=models.CASCADE, related_name="documents",
        null=True, blank=True
    )
    plot = models.ForeignKey(
        ConstructionPlot, on_delete=models.CASCADE, related_name="documents",
        null=True, blank=True
    )
    uploaded_by = models.ForeignKey(User, on_delete=models.DO_NOTHING, related_name="uploaded_documents")
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="documents/%Y/%m/%d/")
    visible_to_storekeepers = models.BooleanField(default=False)
    visible_to_foremen = models.BooleanField(default=False)

    def __str__(self):
        return self.name

