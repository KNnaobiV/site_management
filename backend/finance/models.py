from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum, Q
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


class Budget(models.Model):
    allocated_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    currency = models.CharField(max_length=3, default='NGN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def remaining_amount(self):
        return self.allocated_amount - self.spent_amount


class CostCode(models.Model):
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return self.code


class Expense(models.Model):
    cost_code = models.ForeignKey(
        CostCode,
        on_delete=models.PROTECT,
        related_name='expenses',
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    currency = models.CharField(max_length=3, default='NGN')
    incurred_at = models.DateField(default=timezone.now)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Soft delete and audit fields
    is_deleted = models.BooleanField(default=False, db_index=True)
    deletion_reason = models.TextField(blank=True, default='')
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_expenses',
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    project = models.ForeignKey(
        'core.ConstructionProject',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='project_expenses',
    )
    plot = models.ForeignKey(
        'core.ConstructionPlot',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='plot_expenses',
    )
    work_item = models.ForeignKey(
        'core.WorkItem',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='work_item_expenses',
    )
    job_item = models.ForeignKey(
        'core.JobItem',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='job_item_expenses',
    )

    class Meta:
        ordering = ['-incurred_at', '-created_at']

    def clean(self):
        super().clean()
        target_count = sum(
            bool(value)
            for value in (
                self.project,
                self.plot,
                self.work_item,
                self.job_item,
            )
        )
        if target_count != 1:
            raise ValidationError(
                'An expense must be attached to exactly one project, plot, work item, or job item.'
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ProjectBudget(Budget):
    project = models.OneToOneField(
        'core.ConstructionProject',
        on_delete=models.CASCADE,
        related_name='project_budget',
    )

    class Meta:
        verbose_name = 'Project Budget'
        verbose_name_plural = 'Project Budgets'

    @property
    def spent_amount(self):
        direct = self.project.project_expenses.filter(is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        plots = Expense.objects.filter(plot__construction_project=self.project, is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        work_items = Expense.objects.filter(work_item__construction_plot__construction_project=self.project, is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        job_items = Expense.objects.filter(job_item__work_item__construction_plot__construction_project=self.project, is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return direct + plots + work_items + job_items


class PlotBudget(Budget):
    plot = models.OneToOneField(
        'core.ConstructionPlot',
        on_delete=models.CASCADE,
        related_name='plot_budget',
    )

    class Meta:
        verbose_name = 'Plot Budget'
        verbose_name_plural = 'Plot Budgets'

    @property
    def spent_amount(self):
        direct = self.plot.plot_expenses.filter(is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        work_items = Expense.objects.filter(work_item__construction_plot=self.plot, is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        job_items = Expense.objects.filter(job_item__work_item__construction_plot=self.plot, is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return direct + work_items + job_items


class WorkItemBudget(Budget):
    work_item = models.OneToOneField(
        'core.WorkItem',
        on_delete=models.CASCADE,
        related_name='work_item_budget',
    )

    class Meta:
        verbose_name = 'Work Item Budget'
        verbose_name_plural = 'Work Item Budgets'

    @property
    def spent_amount(self):
        direct = self.work_item.work_item_expenses.filter(is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        job_items = Expense.objects.filter(job_item__work_item=self.work_item, is_deleted=False).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return direct + job_items


class JobItemBudget(Budget):
    job_item = models.OneToOneField(
        'core.JobItem',
        on_delete=models.CASCADE,
        related_name='job_item_budget',
    )

    class Meta:
        verbose_name = 'Job Item Budget'
        verbose_name_plural = 'Job Item Budgets'

    @property
    def spent_amount(self):
        return self.job_item.job_item_expenses.filter(is_deleted=False).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')


def check_job_item_budget_alert(job_item):
    from core.models import Notification

    if not job_item:
        return

    try:
        budget = job_item.job_item_budget
    except Exception:
        return

    if not budget or not budget.allocated_amount or budget.allocated_amount <= Decimal('0.00'):
        return

    total_spent = job_item.job_item_expenses.filter(is_deleted=False).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')

    if total_spent > budget.allocated_amount:
        work_item = getattr(job_item, 'work_item', None)
        plot = getattr(work_item, 'construction_plot', None) if work_item else None
        project = getattr(plot, 'construction_project', None) if plot else None

        if not project:
            return

        # Target user: PM if assigned, or project creator if no PM
        target_user = project.project_manager if project.project_manager else project.created_by
        if not target_user:
            return

        target_url = f"/job-items/{job_item.id}"

        already_notified = Notification.objects.filter(
            user=target_user,
            project=project,
            target_url=target_url,
            is_read=False,
            message__icontains="exceeded its budget"
        ).exists()

        if not already_notified:
            Notification.objects.create(
                user=target_user,
                project=project,
                message=f"Budget alert: Job item '{job_item.job_name}' expenses ({total_spent}) have exceeded its allocated budget ({budget.allocated_amount}).",
                target_url=target_url,
                priority=Notification.Priority.HIGH
            )


@receiver(post_save, sender=Expense)
def check_expense_budget_alert(sender, instance, **kwargs):
    if instance.job_item:
        check_job_item_budget_alert(instance.job_item)


@receiver(post_save, sender=JobItemBudget)
def check_job_item_budget_saved_alert(sender, instance, **kwargs):
    if instance.job_item:
        check_job_item_budget_alert(instance.job_item)

