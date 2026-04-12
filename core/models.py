from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta


from base.models import Picture, Video
from .groups import create_company_group, create_project_group
# Create your models here.

User = get_user_model()

class StatusChoices(models.TextChoices):
        PLANNED = "Planned"
        IN_PROGRESS = "In Progress"
        COMPLETED = "Completed"
        ON_HOLD = "On Hold"
        DELAYED = "Delayed"
        CANCELLED = "Cancelled"


class RoleChoices(models.TextChoices):
    INTERNAL_MEMBER = "Internal Member"
    EXTERNAL_MEMBER = "External Member"
    FOREMAN = "Foreman"
    STOREKEEPER = "Storekeeper"
    PROJECT_MANAGER = "Project Manager"
    CLIENT = "Client"
    CONSULTANT = "Consultant"


class ConstructionProject(models.Model):
    """
    Represents a construction project with associated client 
    and project manager
    """
    created_by = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="created_projects"
    )
    client = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="project_owner"
    )
    project_manager = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="project_manager"
    )
    consultants = models.ManyToManyField(
        User, related_name="project_consultants", blank=True
    )
    project_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    project_name = models.CharField(max_length=100, default="")
    project_description = models.TextField(default="")
    project_start_date = models.DateField(auto_now=True)
    project_end_date = models.DateField(blank=True, null=True)
    actual_start_date = models.DateField(default=timezone.now)
    # add project files

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(
                    project_end_date__gte=models.F('project_start_date')
                ) | models.Q(project_end_date__isnull=True),
                name='end_date_after_start_date'
            ),
            models.UniqueConstraint(
                fields=['created_by', 'project_name'], name='unique_project_name'
            ),
        ]


    def save(self, *args, **kwargs):
        if (self.project_end_date and 
            self.project_end_date < self.project_start_date
        ):
            raise ValueError("Project end date cannot be before start date.")
        if not self.project_name:
            self.project_name = (
                f"Project for {self.client.username} with "
                f"{self.project_manager.username}"
            )
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



class ConstructionSite(models.Model):
    construction_project = models.ForeignKey(
        ConstructionProject, on_delete=models.CASCADE
    )    
    foreman = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="site_foreman"
    )
    storekeeper = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="site_storekeeper"
        )
    address = models.CharField(max_length=255)
    site_opening_date = models.DateField(default=timezone.now)

    def save(self, *args, **kwargs):
        if not self.address:
            raise ValueError("Construction site must have an address.")
        super().save(*args, **kwargs)
    
    @receiver(post_save, sender='core.ConstructionSite')
    def create_site_groups(sender, instance, created, **kwargs):
        """Create site-specific groups when a new construction site is created"""
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


class WorkItem(models.Model):
    """
    Represents a specific work item or phase of construction at a site
    """
    construction_site = models.ForeignKey(
        ConstructionSite, on_delete=models.CASCADE
    )
    work_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    name = models.CharField(max_length=100, default="")
    description = models.TextField(default="")
    proposed_start_date = models.DateField(auto_now=True)
    start_date = models.DateField(null=True, blank=True)
    proposed_end_date = models.DateField(
        default=timezone.now() + timedelta(days=1)
    )
    end_date = models.DateField(null=True, blank=True)

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


class JobItem(models.Model):
    """
    Represents a specific job or task to be performed at a construction site
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
    work_status = models.CharField(
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


class JobReport(models.Model):
    """Daily construction site report tracking work progress and materials"""

    class ReportStatusChoices(models.TextChoices):
        submitted = "Submitted"
        approved = "Approved"
        rejected = "Rejected"

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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    internal_comments = models.TextField(
        blank=True, help_text="Internal comments for project team"
    )
    external_comments = models.TextField(
        blank=True, help_text="Comments visible to client and consultants"
    )
    
    class Meta:
        ordering = ['-report_date']
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
        if self.job_item.actual_start_date:
            self.days_elapsed = (
                self.report_date - self.job_item.actual_start_date
            ).days
        if (
            self.job_item.actual_start_date and \
            self.report_date < self.job_item.actual_start_date
            ):
            raise ValueError(
                "Report date cannot be before job item actual start date."
            )
        
        super().save(*args, **kwargs)
