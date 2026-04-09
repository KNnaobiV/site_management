from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from datetime import timedelta

from base.models import Picture
# Create your models here.

User = get_user_model()

class StatusChoices(models.TextChoices):
        PLANNED = "Planned"
        IN_PROGRESS = "In Progress"
        COMPLETED = "Completed"
        ON_HOLD = "On Hold"
        DELAYED = "Delayed"
        CANCELLED = "Cancelled"


class Company(models.Model):
    """Represents a construction company with associated users"""

    name = models.CharField(max_length=100, default="")
    motto = models.TextField(default="")
    logo = models.ForeignKey(
        Picture, on_delete=models.SET_NULL, null=True, blank=True
    )
    staff = models.ManyToManyField(User, related_name="company_staff")


class ConstructionProject(models.Model):
    """
    Represents a construction project with associated client 
    and project manager
    """
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="projects"
    )
    client = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="project_owner"
    )
    project_manager = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="project_manager"
    )
    project_status = models.CharField(
        max_length=20, choices=StatusChoices.choices, 
        default=StatusChoices.PLANNED
    )
    project_name = models.CharField(max_length=100, default="")
    project_description = models.TextField(default="")
    project_start_date = models.DateField(auto_now=True)
    project_end_date = models.DateField(blank=True, null=True)
    actual_start_date = models.DateField(default=timezone.now())
    # add project files

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
    site_opening_date = models.DateField(default=timezone.now())

    def save(self, *args, **kwargs):
        if not self.address:
            raise ValueError("Construction site must have an address.")
        super().save(*args, **kwargs)


class Material(models.Model):
    """Represents a construction material needed for a project"""

    class UnitsOfMeasure(models.TextChoices):
        PIECE = "Piece"
        KILOGRAM = "Kilogram"
        LITER = "Liter"
        METER = "Meter"
        PCS = "Pcs"
        SQUARE_METER = "Square Meter"
        CUBIC_METER = "Cubic Meter"
        BAG = "Bag"
        LENGTH = "Length"
        ROLL = "Roll"
        OTHER = "Other"
        
    material_name = models.CharField(max_length=50, default="")
    projected_quantity = models.PositiveSmallIntegerField()
    actual_quantity = models.PositiveSmallIntegerField()
    needed_by = models.CharField(max_length=50, default="")
    unit_of_measure = models.CharField(
        max_length=23, choices=UnitsOfMeasure.choices
    )
    
    def save(self, *args, **kwargs):
        if self.projected_quantity < 0:
            raise ValueError("Projected quantity cannot be negative.")
        if self.actual_quantity < 0:
            raise ValueError("Actual quantity cannot be negative.")
        if not self.material_name:
            raise ValueError("Material must have a name.")
        if not self.needed_by:
            raise ValueError("Material must specify who needs it.")
        super().save(*args, **kwargs)


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
    material_needs = models.ManyToManyField(Material)
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
        Picture, on_delete=models.CASCADE, related_name="job_report_pictures"
    )
    reported_by = models.ForeignKey(User, on_delete=models.DO_NOTHING)

    # Report metadata
    report_status = models.CharField(
        max_length=20, choices=ReportStatusChoices.choices, 
        default=ReportStatusChoices.submitted
    )
    report_date = models.DateField(default=timezone.now())
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
    updated_at = models.DateTimeField(auto_now=True)
    
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


class JobMaterialReport(models.Model):
    """Track materials used in daily construction reports"""
    
    job_report = models.ForeignKey(
        JobReport, on_delete=models.CASCADE, related_name="materials_used"
    )
    
    material = models.ForeignKey(Material, on_delete=models.DO_NOTHING)
    artisan = models.CharField(max_length=20, choices=JobItem.Artisans.choices)
    actual_quantity_used = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Actual quantity used on this day"
    )    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Daily Job Report Material"
        verbose_name_plural = "Daily Job Report Materials"
    
    def __str__(self):
        return f"{self.material.material_name} - {self.job_report.report_date}"
    
