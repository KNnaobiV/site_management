from django.contrib import admin
from .models import (
    ConstructionProject,
    ConstructionSite,
    WorkItem,
    JobItem,
    JobReport,
)


@admin.register(ConstructionProject)
class ConstructionProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'client', 'project_manager', 'project_name', 'project_status', 'project_start_date', 'project_end_date')
    search_fields = ('client__username', 'project_manager__username', 'project_name')
    list_filter = ('project_status', 'project_start_date', 'project_end_date')


@admin.register(ConstructionSite)
class ConstructionSiteAdmin(admin.ModelAdmin):
    list_display = ('id', 'construction_project', 'foreman', 'storekeeper', 'address', 'site_opening_date')
    search_fields = ('address', 'foreman__username', 'storekeeper__username', 'construction_project__project_name')
    list_filter = ('site_opening_date', 'construction_project')


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'construction_site', 'name', 'work_status', 'proposed_start_date', 'start_date', 'proposed_end_date', 'end_date')
    search_fields = ('name', 'construction_site__address')
    list_filter = ('work_status', 'proposed_start_date', 'proposed_end_date')


@admin.register(JobItem)
class JobItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'work_item', 'job_name', 'job_artisan', 'work_status', 'projected_start_date', 'projected_end_date')
    search_fields = ('job_name', 'work_item__name')
    list_filter = ('job_artisan', 'work_status', 'projected_start_date', 'projected_end_date')


@admin.register(JobReport)
class JobReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'job_item', 'report_status', 'report_date', 'reported_by', 'expected_completion_date')
    search_fields = ('job_item__job_name', 'reported_by__username')
    list_filter = ('report_status', 'report_date', 'expected_completion_date')
    readonly_fields = ('created_at', 'updated_at')
    ('Timeline', {
        'fields': ('phase_start_date', 'days_elapsed', 'expected_completion_date')
    }),
    ('Metadata', {
        'fields': ('created_at', 'updated_at'),
        'classes': ('collapse',)
    }),

