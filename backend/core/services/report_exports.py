import datetime
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status
from core.models import JobReport
from core.reports import (
    parse_report_date_range,
    build_progress_report_pdf,
    build_progress_report_excel,
)

class ReportExportService:
    """Service to handle the logic of generating PDF/Excel progress reports."""
    
    def __init__(self, user, obj, role):
        self.user = user
        self.obj = obj
        self.role = role

    def export(self, request):
        if self.role == "none":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to export reports.")

        start_date, end_date = parse_report_date_range(request)
        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        obj_type = getattr(self.obj.__class__, "__name__", "")
        
        # Base QuerySet filtering on the object
        queryset = JobReport.objects.all()
        if obj_type == "ConstructionProject":
            queryset = queryset.filter(job_item__work_item__construction_plot__construction_project=self.obj)
            title = f"Project Job Reports: {self.obj.project_name}"
            prefix = f"project_{self.obj.id}"
            entity_level = "project"
        elif obj_type == "ConstructionPlot":
            queryset = queryset.filter(job_item__work_item__construction_plot=self.obj)
            title = f"Plot Job Reports: {self.obj.address}"
            prefix = f"plot_{self.obj.id}"
            entity_level = "plot"
        elif obj_type == "WorkItem":
            queryset = queryset.filter(job_item__work_item=self.obj)
            title = f"Work Item Job Reports: {self.obj.name}"
            prefix = f"workitem_{self.obj.id}"
            entity_level = "workitem"
        elif obj_type == "JobItem":
            queryset = queryset.filter(job_item=self.obj)
            title = f"Job Item Job Reports: {self.obj.job_name}"
            prefix = f"jobitem_{self.obj.id}"
            entity_level = "jobitem"
        else:
            return Response({"detail": "Unsupported export target."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = queryset.filter(
            report_date__gte=start_date,
            report_date__lte=end_date
        )

        # Plot members can only see reports for plots they are assigned to
        if self.role == "plot_member":
            queryset = queryset.filter(job_item__work_item__construction_plot__foremen=self.user)

        queryset = queryset.select_related(
            "reported_by", "job_item", "job_item__work_item", "job_item__work_item__construction_plot"
        ).prefetch_related("photos").order_by('report_date')

        metadata_lines = [
            f"Date range: {start_date.isoformat()} — {end_date.isoformat()} | Generated: {datetime.date.today().isoformat()}"
        ]

        if request.GET.get("format") == "xlsx":
            filename = f"{prefix}_reports_{start_date.isoformat()}_{end_date.isoformat()}.xlsx"
            return build_progress_report_excel(title, metadata_lines, queryset, filename)

        filename = f"{prefix}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        return build_progress_report_pdf(title, metadata_lines, queryset, filename, entity_level=entity_level)
