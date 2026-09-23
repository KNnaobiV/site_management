from rest_framework.decorators import action
from core.services.report_exports import ReportExportService
from core.services.financial_reports import FinancialReportService

class ExportMixin:
    """
    Mixin for ViewSets that provide export-reports and export-financial-report endpoints.
    Requires the ViewSet to be scoped and have `role` in serializer context if used,
    or otherwise we fetch role from the context.
    """

    @action(detail=True, methods=["get"], url_path="export-reports")
    def export_reports(self, request, **kwargs):
        obj = self.get_object()
        
        # We need the role for permissions. If it's a ScopedMixin viewset, it might be in context.
        # Otherwise, we can compute it if not provided.
        ctx = self.get_serializer_context()
        role = ctx.get("role", "none")
        
        # However, to be safe, if role is 'none', ReportExportService will throw PermissionDenied anyway.
        service = ReportExportService(request.user, obj, role)
        return service.export(request)

    @action(detail=True, methods=["get"], url_path="export-financial-report")
    def export_financial_report(self, request, **kwargs):
        obj = self.get_object()
        
        service = FinancialReportService(request.user, obj)
        return service.export(request)
