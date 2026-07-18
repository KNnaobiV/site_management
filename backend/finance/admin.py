from django.contrib import admin

from .models import (
    CostCode,
    Expense,
    JobItemBudget,
    PlotBudget,
    ProjectBudget,
    WorkItemBudget,
)


@admin.register(CostCode)
class CostCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'description')
    search_fields = ('code', 'description')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        'amount',
        'currency',
        'cost_code',
        'incurred_at',
        'project',
        'plot',
        'work_item',
        'job_item',
    )
    list_filter = ('cost_code', 'currency', 'incurred_at')
    search_fields = (
        'description',
        'project__project_name',
        'plot__plot_number',
        'work_item__name',
        'job_item__job_name',
    )


@admin.register(ProjectBudget)
class ProjectBudgetAdmin(admin.ModelAdmin):
    list_display = ('project', 'allocated_amount', 'spent_amount', 'remaining_amount', 'currency')
    search_fields = ('project__project_name',)


@admin.register(PlotBudget)
class PlotBudgetAdmin(admin.ModelAdmin):
    list_display = ('plot', 'allocated_amount', 'spent_amount', 'remaining_amount', 'currency')
    search_fields = ('plot__plot_number', 'plot__address')


@admin.register(WorkItemBudget)
class WorkItemBudgetAdmin(admin.ModelAdmin):
    list_display = ('work_item', 'allocated_amount', 'spent_amount', 'remaining_amount', 'currency')
    search_fields = ('work_item__name',)


@admin.register(JobItemBudget)
class JobItemBudgetAdmin(admin.ModelAdmin):
    list_display = ('job_item', 'allocated_amount', 'spent_amount', 'remaining_amount', 'currency')
    search_fields = ('job_item__job_name',)
