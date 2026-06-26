from django.contrib import admin
from .models import (
    ConstructionProject,
    ConstructionPlot,
    WorkItem,
    JobItem,
    JobReport,
)


@admin.register(ConstructionProject)
class ConstructionProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'client', 'project_manager', 'project_name', 'project_status', 'start_date', 'target_end_date')
    search_fields = ('client__username', 'project_manager__username', 'project_name')
    list_filter = ('project_status', 'start_date', 'target_end_date')


@admin.register(ConstructionPlot)
class ConstructionPlotAdmin(admin.ModelAdmin):
    list_display = ('id', 'construction_project', 'foreman', 'storekeeper', 'address', 'start_date', 'target_end_date')
    search_fields = ('address', 'foreman__username', 'storekeeper__username', 'construction_project__project_name')
    list_filter = ('start_date', 'target_end_date', 'construction_project')


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'construction_plot', 'name', 'work_status', 'start_date', 'target_end_date')
    search_fields = ('name', 'construction_plot__address')
    list_filter = ('work_status', 'start_date', 'target_end_date')


@admin.register(JobItem)
class JobItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'work_item', 'job_name', 'job_artisan', 'job_status', 'start_date', 'target_end_date')
    search_fields = ('job_name', 'work_item__name')
    list_filter = ('job_artisan', 'job_status', 'start_date', 'target_end_date')


@admin.register(JobReport)
class JobReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'job_item', 'report_status', 'priority', 'report_date', 'reported_by', 'expected_completion_date')
    search_fields = ('job_item__job_name', 'reported_by__username')
    list_filter = ('report_status', 'priority', 'report_date', 'expected_completion_date')
    readonly_fields = ('created_at', 'updated_at')
