from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class Budget(models.Model):
    allocated_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


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
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        return self.project.project_expenses.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')


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
        return self.plot.plot_expenses.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')


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
        return self.work_item.work_item_expenses.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')


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
        return self.job_item.job_item_expenses.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
