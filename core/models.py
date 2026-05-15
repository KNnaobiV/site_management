import uuid

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta, date


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
    proposed_start_date = models.DateField(default=date.today)
    proposed_end_date = models.DateField(blank=True, null=True)
    actual_start_date = models.DateField(blank=True, null=True)
    actual_end_date = models.DateField(blank=True, null=True)
    number_of_plots = models.PositiveSmallIntegerField(default=1)
    # add project files

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    proposed_end_date__gte=models.F('proposed_start_date')
                ) | models.Q(proposed_end_date__isnull=True),
                name='proposed_end_date_after_proposed_start_date'
            ),
            models.CheckConstraint(
                condition=models.Q(
                    actual_end_date__gte=models.F('actual_start_date')
                ) | models.Q(actual_end_date__isnull=True),
                name='actual_end_date_after_actual_start_date'
            ),
            models.UniqueConstraint(
                fields=['created_by', 'project_name'], name='unique_project_name'
            ),
        ]


    def save(self, *args, **kwargs):
        if self.proposed_end_date and self.proposed_start_date and \
                self.proposed_end_date < self.proposed_start_date:
            raise ValueError("Project end date cannot be before start date.")
        if self.actual_end_date and self.actual_start_date and \
                self.actual_end_date < self.actual_start_date:
            raise ValueError("Project end date cannot be before start date.")
        if not self.project_name:
            client_name = self.client.username if self.client else "Unknown Client"
            pm_name = self.project_manager.username if self.project_manager else "Unknown PM"
            self.project_name = f"Project for {client_name} with {pm_name}"
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
    plot_opening_date = models.DateField(default=timezone.now)
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
    proposed_start_date = models.DateField()
    start_date = models.DateField(null=True, blank=True)
    proposed_end_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    # Checklist: [{"text": "Pour footings", "done": false}, ...]
    checklist = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-updated_at']

    def save(self, *args, **kwargs):
        if (
            self.proposed_end_date and 
            self.proposed_end_date < self.proposed_start_date
        ):
            raise ValueError(
                "Proposed end date cannot be before proposed start date."
            )
        if (
            self.end_date and 
            self.start_date and 
            self.end_date < self.start_date
        ):
            raise ValueError("End date cannot be before start date.")
        if not self.name:
            raise ValueError("Work item must have a name.")
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

    work_item = models.ForeignKey(
        WorkItem, on_delete=models.CASCADE, related_name="job_items"
    )
    job_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    job_artisan = models.CharField(max_length=20, choices=Artisans.choices)
    job_name = models.CharField(max_length=50, default="")
    job_description = models.TextField(default="")
    projected_start_date = models.DateField()
    projected_end_date = models.DateField()
    actual_start_date = models.DateField(null=True, blank=True)
    actual_end_date = models.DateField(null=True, blank=True)
    # Material requirements: [{"name": "Cement", "quantity": 50, "unit": "bags"}, ...]
    material_requirements = models.JSONField(default=list, blank=True)
    estimated_hours = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True
    )

    class Meta:
        ordering = ['-updated_at']

    def save(self, *args, **kwargs):
        if (
            self.projected_end_date and 
            self.projected_end_date < self.projected_start_date
        ):
            raise ValueError(
                "Projected end date cannot be before projected start date."
            )
        if (
            self.actual_end_date and 
            self.actual_start_date and 
            self.actual_end_date < self.actual_start_date
        ):
            raise ValueError(
                "Actual end date cannot be before actual start date.")
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
    
    def __str__(self):
        return (f"{self.job_item.job_name.title()} for "
                f"{self.job_item.work_item.name} - {self.report_date}"
            )
    
    @property
    def days_elapsed(self):
        """Calculate days elapsed since the job item started"""
        if self.job_item.actual_start_date:
            return (self.report_date - self.job_item.actual_start_date).days
    
    def save(self, *args, **kwargs):
        """Calculate days elapsed when saving"""
        if (
            self.job_item.actual_start_date and \
            self.report_date < self.job_item.actual_start_date
            ):
            raise ValueError(
                "Report date cannot be before job item actual start date."
            )
        
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

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.user.username} on {self.report}"


# Backwards-compat alias so existing migrations don't break before re-running them
ConstructionSite = ConstructionPlot
SiteRole = PlotRole
SiteInvitation = PlotInvitation


class WorkItemImage(models.Model):
    """Photo attached to a WorkItem."""
    work_item = models.ForeignKey(
        WorkItem, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="work_items/%Y/%m/%d/")
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.work_item.name}"


class JobReportImage(models.Model):
    """Photo attached to a JobReport (daily report)."""
    report = models.ForeignKey(
        JobReport, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="reports/%Y/%m/%d/")
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for report {self.report.id} ({self.report.report_date})"


@receiver(post_save, sender=ProjectInvitation)
def create_project_invitation_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.invitee,
            project=instance.project,
            message=f"You have been invited to join project '{instance.project.project_name}' as {instance.role}.",
            priority=Notification.Priority.HIGH
        )

@receiver(post_save, sender=PlotInvitation)
def create_plot_invitation_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.invitee,
            project=instance.plot.construction_project,
            message=f"You have been invited to join plot '{instance.plot.address}' as {instance.role}.",
            priority=Notification.Priority.HIGH
        )
