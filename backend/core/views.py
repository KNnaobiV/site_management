"""
core/api/views.py
-----------------
All ViewSets for the construction management system.

Architecture
------------
- Every ViewSet resolves the project or plot from URL kwargs in
  `get_project()` / `get_plot()` (cached on the instance).
- `get_serializer_context()` is overridden to inject `role` so
  RoleFilteredSerializer knows which fields to expose.
- `get_queryset()` is always scoped to the authenticated user so
  users cannot enumerate resources they don't belong to.
- Custom actions (@action) handle invitation workflow endpoints.
"""
from __future__ import annotations

import io
import os
import datetime
from decimal import Decimal

import logging
from django.conf import settings
from django.core.mail import EmailMessage
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Q as db_Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Image as PDFImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

logger = logging.getLogger(__name__)

from core.models import (
    ConstructionProject, 
    ConstructionPlot, 
    WorkItem, 
    JobItem, 
    JobReport,
    Notification,
    JobReportComment,
    ProjectInvitation, 
    PlotInvitation,
    Document,
)
from base.models import Picture
from core.roles import get_project_role, get_plot_role, SEES_UNAPPROVED_ROLES, can_view_finance
from core.services import (
    invite_to_project,
    invite_to_plot,
    accept_project_invitation,
    decline_project_invitation,
    revoke_project_invitation,
    accept_plot_invitation,
    decline_plot_invitation,
    revoke_plot_invitation,
)

from .permissions import (
    IsProjectMember,
    CanManageProject,
    IsProjectOwnerOrCreator,
    IsPlotMember,
    CanManagePlot,
    CanSubmitReport,
    CanReviewReport,
    CanSendProjectInvitation,
    CanSendPlotInvitation,
    IsInvitee,
    IsInviterOrProjectOwner,
    CanCreateWorkItem,
    CanUpdateWorkItem,
    CanDeleteWorkItem,
    CanApproveWorkItem,
    CanCreateJobItem,
    CanUpdateJobItem,
    CanDeleteJobItem,
    CanApproveJobItem,
    CanManageDocuments,
)
from .serializers import (
    ConstructionProjectSerializer,
    ConstructionPlotSerializer,
    WorkItemSerializer,
    JobItemSerializer,
    JobReportSerializer,
    JobReportCommentSerializer,
    NotificationSerializer,
    ProjectInvitationSerializer,
    PlotInvitationSerializer,
    WorkItemImageUploadSerializer,
    JobReportImageUploadSerializer,
    DocumentSerializer,
)

from finance.models import Expense
from .reports import (
    parse_report_date_range,
    build_progress_report_pdf,
    build_progress_report_excel,
    build_financial_report_pdf,
    build_financial_report_excel,
    XLSXRenderer,
    PDFRenderer,
)
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer


def get_artisan_name(job_item):
    if not job_item:
        return "—"
    if getattr(job_item, "job_artisan", None) == "Other" and getattr(job_item, "custom_artisan", None):
        return job_item.custom_artisan
    return getattr(job_item, "job_artisan", None) or "—"


# ---------------------------------------------------------------------------
# Mixins
# ---------------------------------------------------------------------------

User = get_user_model()


def _build_figures_table(figures, styles):
    """
    Given a list of (fig_num, pic_obj, caption_text),
    builds a compact 2-column Flowable Table containing thumbnail images and captions.
    """
    if not figures:
        return None

    caption_style = ParagraphStyle(
        "FigureCaption",
        parent=styles.get("Normal", styles["BodyText"]),
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#374151"),
        alignment=1,
    )

    fig_table_data = []
    row = []
    for fig_num, pic, caption in figures:
        image_path = getattr(pic.img, 'path', None) if getattr(pic, 'img', None) else None
        if image_path and os.path.exists(image_path):
            try:
                cell_flowables = [
                    PDFImage(image_path, width=2.4 * inch, height=1.6 * inch),
                    Spacer(1, 4),
                    Paragraph(f"<b>Fig. {fig_num}</b>: {caption}", caption_style)
                ]
                row.append(cell_flowables)
                if len(row) == 2:
                    fig_table_data.append(row)
                    row = []
            except Exception:
                continue

    if row:
        while len(row) < 2:
            row.append("")
        fig_table_data.append(row)

    if not fig_table_data:
        return None

    figures_table = Table(fig_table_data, colWidths=[265, 265])
    figures_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return figures_table


class ProjectScopedMixin:
    """
    Mixin for ViewSets that live under /projects/{project_pk}/.
    Resolves and caches the parent ConstructionProject.
    """
    _project_cache = None

    def get_project(self) -> ConstructionProject | None:
        if self._project_cache is None:
            project_pk = self.kwargs.get("project_pk")
            if not project_pk:
                return None
            self._project_cache = get_object_or_404(
                ConstructionProject, pk=project_pk
            )
        return self._project_cache

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        project = self.get_project()
        if project:
            ctx["role"] = get_project_role(self.request.user, project)
            ctx["project"] = project
        else:
            # Fallback for flat access or when project context isn't available
            ctx["role"] = "none"
        return ctx


class PlotScopedMixin:
    """
    Mixin for ViewSets that live under /projects/{project_pk}/plots/{plot_pk}/.
    Resolves and caches the parent ConstructionPlot.
    """
    _plot_cache = None

    def get_plot(self) -> ConstructionPlot | None:
        if self._plot_cache is None:
            query_params = (
                getattr(self.request, "query_params", getattr(self.request, "GET", {}))
                if hasattr(self, "request") and self.request
                else {}
            )
            plot_pk = (
                self.kwargs.get("plot_pk") or
                (self.kwargs.get("pk") if self.__class__.__name__ == "ConstructionPlotViewSet" else None) or
                query_params.get("plot") or
                query_params.get("plot_id") or
                query_params.get("construction_plot")
            )
            project_pk = (
                self.kwargs.get("project_pk") or
                (self.kwargs.get("pk") if self.__class__.__name__ == "ConstructionProjectViewSet" else None) or
                query_params.get("project") or
                query_params.get("project_id")
            )
            if plot_pk:
                filter_kwargs = {"pk": plot_pk}
                if project_pk:
                    filter_kwargs["construction_project__pk"] = project_pk
                self._plot_cache = ConstructionPlot.objects.filter(**filter_kwargs).first()
                if self._plot_cache:
                    return self._plot_cache

            # Try resolving from jobitem_pk (nested /jobitems/{jobitem_pk}/) or pk (flat /jobitems/{pk}/)
            jobitem_pk = (
                self.kwargs.get("jobitem_pk") or
                (self.kwargs.get("pk") if self.__class__.__name__ == "JobItemViewSet" else None)
            )
            if jobitem_pk:
                ji = JobItem.objects.filter(pk=jobitem_pk).select_related(
                    "work_item__construction_plot"
                ).first()
                if ji and ji.work_item and ji.work_item.construction_plot:
                    self._plot_cache = ji.work_item.construction_plot
                    return self._plot_cache

            # Try resolving from workitem_pk (nested /workitems/{workitem_pk}/) or pk (flat /workitems/{pk}/)
            workitem_pk = (
                self.kwargs.get("workitem_pk") or
                (self.kwargs.get("pk") if self.__class__.__name__ == "WorkItemViewSet" else None)
            )
            if workitem_pk:
                wi = WorkItem.objects.filter(pk=workitem_pk).select_related(
                    "construction_plot"
                ).first()
                if wi and wi.construction_plot:
                    self._plot_cache = wi.construction_plot
                    return self._plot_cache
        return self._plot_cache

    def get_project(self) -> ConstructionProject | None:
        plot = self.get_plot()
        return plot.construction_project if plot else None

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        plot = self.get_plot()
        if plot:
            ctx["role"] = get_plot_role(self.request.user, plot)
            ctx["plot"] = plot
        else:
            ctx["role"] = "none"
        return ctx


# ---------------------------------------------------------------------------
# ConstructionProject ViewSet
# ---------------------------------------------------------------------------

class ConstructionProjectViewSet(viewsets.ModelViewSet):
    """
    list    GET  /projects/                     → projects the user belongs to
    create  POST /projects/                     → any authenticated user
    retrieve GET /projects/{pk}/               → project members only
    update  PUT/PATCH /projects/{pk}/          → owner/client/PM only
    destroy DELETE /projects/{pk}/             → owner only

    Extra actions
    -------------
    POST /projects/{pk}/invite/                → send a project invitation
    GET  /projects/{pk}/invitations/           → list project invitations
    """
    serializer_class = ConstructionProjectSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer, XLSXRenderer, PDFRenderer]

    def get_project(self):
        # For actions that run on a single project instance
        return self.get_object()

    def get_permissions(self):
        if self.action in ("list", "create"):
            return [IsAuthenticated()]
        if self.action in ("retrieve",):
            return [IsAuthenticated(), IsProjectMember()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), CanManageProject()]
        if self.action in ("destroy", "restore"):
            return [IsAuthenticated(), IsProjectOwnerOrCreator()]
        if self.action in ("invite", "list_invitations"):
            return [IsAuthenticated(), CanSendProjectInvitation()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if self.action in ("export_reports", "export_financial_report"):
            qs = ConstructionProject.objects.all()
            if not getattr(user, "is_superuser", False):
                qs = qs.filter(is_deleted=False)
            return qs

        qs = ConstructionProject.objects.filter(
            # Any role on the project
            db_Q(created_by=user) |
            db_Q(client=user) |
            db_Q(project_manager=user) |
            db_Q(consultants=user) |
            db_Q(constructionplot__foremen=user)
        ).distinct()
        
        if not getattr(user, "is_superuser", False):
            qs = qs.filter(is_deleted=False)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # For retrieve/update/destroy, resolve role from the object
        if self.kwargs.get("pk"):
            try:
                project = ConstructionProject.objects.get(pk=self.kwargs["pk"])
                ctx["role"] = get_project_role(self.request.user, project)
            except ConstructionProject.DoesNotExist:
                ctx["role"] = "none"
        else:
            # list / create – owner since they're creating it
            ctx["role"] = "owner"
        return ctx

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        name_confirm = request.data.get("project_name")
        if name_confirm != project.project_name:
            return Response(
                {"detail": "Project name mismatch. Cannot delete."},
                status=status.HTTP_400_BAD_REQUEST
            )
        project.is_deleted = True
        project.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        project = self.get_object()
        project.is_deleted = False
        project.save()
        return Response({"status": "restored"})

    # ---- invitation actions ------------------------------------------------

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        """
        POST /projects/{pk}/invite/
        Body: { "invitee_id": <int>, "role": "<role>", "message": "" }
        """
        project = self.get_project()
        serializer = ProjectInvitationSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        try:
            invitation = invite_to_project(
                actor=request.user,
                project=project,
                invitee=serializer.validated_data["invitee"],
                role=serializer.validated_data["role"],
                message=serializer.validated_data.get("message", ""),
            )
        except (PermissionDenied, ValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            ProjectInvitationSerializer(invitation, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="invitations")
    def list_invitations(self, request, pk=None):
        """GET /projects/{pk}/invitations/ — visible to owner/client/PM."""
        project = self.get_project()
        qs = ProjectInvitation.objects.filter(project=project).select_related(
            "invited_by", "invitee"
        )
        serializer = ProjectInvitationSerializer(
            qs, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="remove-user")
    def remove_user(self, request, pk=None):
        project = self.get_project()
        user_id = request.data.get("user_id")
        user = get_object_or_404(User, pk=user_id)
        
        if project.client == user:
            project.client = None
        elif project.project_manager == user:
            project.project_manager = None
        elif project.consultants.filter(pk=user.pk).exists():
            project.consultants.remove(user)
        else:
            return Response({"detail": "User not in project."}, status=status.HTTP_400_BAD_REQUEST)
        
        project.save()
        return Response({"status": "user removed"})

    @action(detail=True, methods=["get"], url_path="all-work-items")
    def all_work_items(self, request, pk=None):
        project = self.get_project()
        qs = WorkItem.objects.filter(construction_plot__construction_project=project).order_by('name')
        serializer = WorkItemSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="all-job-items")
    def all_job_items(self, request, pk=None):
        project = self.get_project()
        qs = JobItem.objects.filter(work_item__construction_plot__construction_project=project).order_by('job_name')
        serializer = JobItemSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="reports")
    def reports(self, request, pk=None):
        project = self.get_project()
        role = get_project_role(request.user, project)
        if role == "none":
            raise PermissionDenied("You do not have permission to view reports on this project.")
        
        qs = JobReport.objects.filter(
            job_item__work_item__construction_plot__construction_project=project
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by('-report_date')
        
        if role == "plot_member":
            qs = qs.filter(job_item__work_item__construction_plot__foremen=request.user)

        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="export-reports")
    def export_reports(self, request, pk=None):
        project = self.get_project()
        role = get_project_role(request.user, project)
        if role == "none":
            raise PermissionDenied("You do not have permission to export reports on this project.")

        start_date, end_date = parse_report_date_range(request)
        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = JobReport.objects.filter(
            job_item__work_item__construction_plot__construction_project=project,
            report_date__gte=start_date,
            report_date__lte=end_date
        )
        if role == "plot_member":
            queryset = queryset.filter(job_item__work_item__construction_plot__foremen=request.user)

        queryset = queryset.select_related(
            "reported_by", "job_item", "job_item__work_item", "job_item__work_item__construction_plot"
        ).prefetch_related("photos").order_by('report_date')

        title = f"Project Job Reports: {project.project_name}"
        metadata_lines = [
            f"Date range: {start_date.isoformat()} — {end_date.isoformat()} | Generated: {datetime.date.today().isoformat()}"
        ]
        if request.GET.get("format") == "xlsx":
            filename = f"project_{project.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.xlsx"
            return build_progress_report_excel(title, metadata_lines, queryset, filename)

        filename = f"project_{project.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        return build_progress_report_pdf(title, metadata_lines, queryset, filename, entity_level="project")

    @action(detail=True, methods=["get"], url_path="export-financial-report")
    def export_financial_report(self, request, pk=None):
        project = self.get_project()
        if not can_view_finance(request.user, project):
            raise PermissionDenied("You do not have permission to view or export financial reports for this project.")

        expenses = Expense.objects.filter(
            db_Q(project=project) |
            db_Q(plot__construction_project=project) |
            db_Q(work_item__construction_plot__construction_project=project) |
            db_Q(job_item__work_item__construction_plot__construction_project=project),
            is_deleted=False
        ).select_related(
            "cost_code", "plot", "work_item", "job_item",
            "job_item__work_item", "job_item__work_item__construction_plot"
        ).order_by("incurred_at", "created_at")

        budget = getattr(project, "project_budget", None)
        allocated = budget.allocated_amount if budget else Decimal("0.00")
        has_budget = allocated > 0
        spent = project.spent_amount
        remaining = allocated - spent if has_budget else None
        currency = budget.currency if budget else "NGN"

        plots_qs = project.constructionplot_set.all()

        itemized_sheet_title = "Itemized Expenses"
        itemized_headers = ["Date", "Work Item", "Job Item", "Artisan", "Amount Paid"]
        itemized_rows_xlsx = []
        itemized_rows_pdf = []
        for exp in expenses:
            d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
            w_str = (
                exp.work_item.name if exp.work_item else
                exp.job_item.work_item.name if exp.job_item else
                "General"
            )
            j_str = exp.job_item.job_name if exp.job_item else "General"
            artisan_str = get_artisan_name(exp.job_item)

            itemized_rows_xlsx.append([d_str, w_str, j_str, artisan_str, float(exp.amount)])
            itemized_rows_pdf.append([d_str, w_str, j_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])

        # 1. Plots Breakdown
        plots_headers_xlsx = ["Plot", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
        plots_headers_pdf = ["Plot", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
        plots_rows_xlsx = []
        plots_rows_pdf = []
        for plot in plots_qs:
            p_budget = getattr(plot, "plot_budget", None)
            p_alloc = p_budget.allocated_amount if p_budget else Decimal("0.00")
            p_has_b = p_alloc > 0
            p_spent = plot.spent_amount
            p_rem = p_alloc - p_spent if p_has_b else None
            p_rate = f"{(p_spent / p_alloc * 100):.1f}%" if p_has_b else "N/A"
            s_date = plot.start_date.isoformat() if hasattr(plot.start_date, "isoformat") else str(plot.start_date)
            e_date = plot.target_end_date.isoformat() if hasattr(plot.target_end_date, "isoformat") else str(plot.target_end_date)
            p_label = plot.plot_name or plot.address

            plots_rows_xlsx.append([p_label, s_date, e_date, float(p_alloc) if p_has_b else "N/A", float(p_spent), float(p_rem) if p_has_b and p_rem is not None else "N/A", p_rate])
            plots_rows_pdf.append([p_label, s_date, e_date, f"{currency} {p_alloc:,.2f}" if p_has_b else "N/A", f"{currency} {p_spent:,.2f}", f"{currency} {p_rem:,.2f}" if p_has_b and p_rem is not None else "N/A", p_rate])

        # 2. Work Items Breakdown
        work_items_qs = WorkItem.objects.filter(construction_plot__construction_project=project).select_related("construction_plot")
        work_headers_xlsx = ["Work Item", "Plot", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
        work_headers_pdf = ["Work Item", "Plot", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
        work_rows_xlsx = []
        work_rows_pdf = []
        for wi in work_items_qs:
            w_budget = getattr(wi, "work_item_budget", None)
            w_alloc = w_budget.allocated_amount if w_budget else Decimal("0.00")
            w_has_b = w_alloc > 0
            w_spent = wi.spent_amount
            w_rem = w_alloc - w_spent if w_has_b else None
            w_rate = f"{(w_spent / w_alloc * 100):.1f}%" if w_has_b else "N/A"
            s_date = wi.start_date.isoformat() if hasattr(wi.start_date, "isoformat") else str(wi.start_date)
            e_date = wi.target_end_date.isoformat() if hasattr(wi.target_end_date, "isoformat") else str(wi.target_end_date)
            p_label = wi.construction_plot.plot_name or wi.construction_plot.address

            work_rows_xlsx.append([wi.name, p_label, s_date, e_date, float(w_alloc) if w_has_b else "N/A", float(w_spent), float(w_rem) if w_has_b and w_rem is not None else "N/A", w_rate])
            work_rows_pdf.append([wi.name, p_label, s_date, e_date, f"{currency} {w_alloc:,.2f}" if w_has_b else "N/A", f"{currency} {w_spent:,.2f}", f"{currency} {w_rem:,.2f}" if w_has_b and w_rem is not None else "N/A", w_rate])

        # 3. Job Items Breakdown
        job_items_qs = JobItem.objects.filter(work_item__construction_plot__construction_project=project).select_related("work_item")
        job_headers_xlsx = ["Job Item", "Work Item", "Artisan", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Utilization"]
        job_headers_pdf = ["Job Item", "Work Item", "Artisan", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Utilization"]
        job_rows_xlsx = []
        job_rows_pdf = []
        for ji in job_items_qs:
            j_budget = getattr(ji, "job_item_budget", None)
            j_alloc = j_budget.allocated_amount if j_budget else Decimal("0.00")
            j_has_b = j_alloc > 0
            j_spent = ji.spent_amount
            j_rate = f"{(j_spent / j_alloc * 100):.1f}%" if j_has_b else "N/A"
            s_date = ji.start_date.isoformat() if hasattr(ji.start_date, "isoformat") else str(ji.start_date)
            e_date = ji.target_end_date.isoformat() if hasattr(ji.target_end_date, "isoformat") else str(ji.target_end_date)
            artisan_str = get_artisan_name(ji)

            job_rows_xlsx.append([ji.job_name, ji.work_item.name, artisan_str, s_date, e_date, float(j_alloc) if j_has_b else "N/A", float(j_spent), j_rate])
            job_rows_pdf.append([ji.job_name, ji.work_item.name, artisan_str, s_date, e_date, f"{currency} {j_alloc:,.2f}" if j_has_b else "N/A", f"{currency} {j_spent:,.2f}", j_rate])

        xlsx_breakdowns = [
            ("Plots Breakdown", plots_headers_xlsx, plots_rows_xlsx),
            ("Work Items Breakdown", work_headers_xlsx, work_rows_xlsx),
            ("Jobs Breakdown", job_headers_xlsx, job_rows_xlsx),
        ]

        pdf_breakdowns = [
            ("Plots Breakdown", plots_headers_pdf, plots_rows_pdf, [120, 65, 65, 75, 75, 75, 57]),
            ("Work Items Breakdown", work_headers_pdf, work_rows_pdf, [105, 95, 60, 60, 58, 58, 58, 38]),
            ("Jobs Breakdown", job_headers_pdf, job_rows_pdf, [95, 95, 75, 60, 60, 55, 55, 37]),
        ]

        if request.GET.get("format") == "xlsx":
            header_title = f"Financial Report: {project.project_name}"
            metadata_pairs = [("Generated:", datetime.date.today().isoformat()), ("Currency:", currency)]
            summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
            summary_values = [
                float(allocated) if has_budget else "N/A",
                float(spent),
                float(remaining) if has_budget and remaining is not None else "N/A",
                f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
            ]
            filename = f"financial_report_project_{project.id}_{datetime.date.today().isoformat()}.xlsx"
            return build_financial_report_excel(
                header_title, metadata_pairs, summary_headers, summary_values,
                itemized_sheet_title=itemized_sheet_title,
                itemized_headers=itemized_headers,
                itemized_rows=itemized_rows_xlsx,
                filename=filename,
                breakdowns=xlsx_breakdowns
            )

        # PDF output
        title = f"Financial Report: {project.project_name}"
        metadata_lines = [f"Generated: {datetime.date.today().isoformat()} | Currency: {currency}"]
        summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
        summary_values = [
            f"{currency} {allocated:,.2f}" if has_budget else "N/A",
            f"{currency} {spent:,.2f}",
            f"{currency} {remaining:,.2f}" if has_budget and remaining is not None else "N/A",
            f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
        ]
        itemized_heading = "Itemized Expenditures"
        filename = f"financial_report_project_{project.id}_{datetime.date.today().isoformat()}.pdf"
        return build_financial_report_pdf(
            title, metadata_lines, summary_headers, summary_values, [130, 130, 130, 130],
            itemized_heading=itemized_heading,
            itemized_headers=itemized_headers,
            itemized_rows=itemized_rows_pdf[:80],
            itemized_col_widths=[75, 120, 130, 100, 107],
            filename=filename,
            breakdowns=pdf_breakdowns
        )


# ---------------------------------------------------------------------------
# ConstructionPlot ViewSet
# ---------------------------------------------------------------------------

class ConstructionPlotViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/plots/

    Extra actions
    -------------
    POST /projects/{project_pk}/plots/{pk}/invite/
    GET  /projects/{project_pk}/plots/{pk}/invitations/
    """
    serializer_class = ConstructionPlotSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer, XLSXRenderer, PDFRenderer]

    def perform_create(self, serializer):
        project = self.get_project()
        if project:
            serializer.save(construction_project=project)
        else:
            serializer.save()

    def get_plot(self):
        return self.get_object()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectMember()]
        if self.action == "create":
            return [IsAuthenticated(), CanManageProject()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), CanManagePlot()]
        if self.action == "destroy":
            return [IsAuthenticated(), IsProjectOwnerOrCreator()]
        if self.action in ("invite", "list_invitations"):
            return [IsAuthenticated(), CanSendPlotInvitation()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if self.action in ("export_reports", "export_financial_report"):
            return ConstructionPlot.objects.all()

        project = self.get_project()
        user = self.request.user
        
        if project:
            role = get_project_role(user, project)
            if role in {"owner", "client", "project_manager", "consultant"}:
                return ConstructionPlot.objects.filter(construction_project=project)
            # foreman/storekeeper see only their own plot
            return ConstructionPlot.objects.filter(
                construction_project=project
            ).filter(
                db_Q(foremen=user)
            )
        else:
            # Top-level list: all plots user belongs to across all projects
            return ConstructionPlot.objects.filter(
                db_Q(construction_project__created_by=user) |
                db_Q(construction_project__client=user) |
                db_Q(construction_project__project_manager=user) |
                db_Q(construction_project__consultants=user) |
                db_Q(foremen=user)
            ).distinct()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()  # ProjectScopedMixin sets role
        
        # For plot detail actions or retrieve, resolve with plot-level role
        plot_pk = self.kwargs.get("pk")
        if plot_pk:
            try:
                plot = ConstructionPlot.objects.get(pk=plot_pk)
                ctx["role"] = get_plot_role(self.request.user, plot)
                ctx["plot"] = plot
            except ConstructionPlot.DoesNotExist:
                pass
        return ctx

    def perform_create(self, serializer):
        project = self.get_project()
        serializer.save(construction_project=project)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, project_pk=None, pk=None):
        plot = self.get_object()
        serializer = PlotInvitationSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        try:
            invitation = invite_to_plot(
                actor=request.user,
                plot=plot,
                invitee=serializer.validated_data["invitee"],
                role=serializer.validated_data["role"],
                message=serializer.validated_data.get("message", ""),
            )
        except (PermissionDenied, ValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            PlotInvitationSerializer(invitation, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="invitations")
    def list_invitations(self, request, project_pk=None, pk=None):
        plot = self.get_object()
        qs = PlotInvitation.objects.filter(plot=plot).select_related(
            "invited_by", "invitee"
        )
        return Response(
            PlotInvitationSerializer(qs, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["post"], url_path="remove-user")
    def remove_user(self, request, project_pk=None, pk=None):
        plot = self.get_object()
        user_id = request.data.get("user_id")
        user = get_object_or_404(User, pk=user_id)
        
        if plot.foremen.filter(pk=user.pk).exists():
            plot.foremen.remove(user)
        else:
            return Response({"detail": "User not in plot."}, status=status.HTTP_400_BAD_REQUEST)
        
        plot.save()
        return Response({"status": "user removed"})

    @action(detail=True, methods=["get"], url_path="reports")
    def reports(self, request, project_pk=None, pk=None):
        """GET /projects/{project_pk}/plots/{pk}/reports/ — all reports for this plot."""
        plot = self.get_object()
        role = get_plot_role(request.user, plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to view reports on this plot.")
        qs = JobReport.objects.filter(
            job_item__work_item__construction_plot=plot
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by("-report_date")
        
        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="export-reports")
    def export_reports(self, request, project_pk=None, pk=None):
        plot = self.get_object()
        if not plot:
            return Response({"detail": "Plot not found."}, status=status.HTTP_404_NOT_FOUND)
        role = get_plot_role(request.user, plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to export reports on this plot.")

        start_date, end_date = parse_report_date_range(request)
        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = JobReport.objects.filter(job_item__work_item__construction_plot=plot)
        if request.GET.get("job_item_id"):
            queryset = queryset.filter(job_item__pk=request.GET["job_item_id"])
        elif request.GET.get("work_item_id"):
            queryset = queryset.filter(job_item__work_item__pk=request.GET["work_item_id"])

        queryset = queryset.filter(report_date__gte=start_date, report_date__lte=end_date).select_related(
            "reported_by", "job_item", "job_item__work_item", "job_item__work_item__construction_plot"
        ).prefetch_related("photos").order_by('report_date')

        title = f"Plot Report Export: {plot.address}"
        metadata_lines = [
            f"Project: {plot.construction_project.project_name}",
            f"Date range: {start_date.isoformat()} — {end_date.isoformat()}"
        ]
        if request.GET.get("work_item_id"):
            metadata_lines.append(f"Filtered by work item ID: {request.GET['work_item_id']}")
        if request.GET.get("job_item_id"):
            metadata_lines.append(f"Filtered by job item ID: {request.GET['job_item_id']}")

        filename = f"plot_{plot.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        if request.GET.get("format") == "xlsx":
            filename = f"plot_{plot.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.xlsx"
            return build_progress_report_excel(title, metadata_lines, queryset, filename)

        return build_progress_report_pdf(title, metadata_lines, queryset, filename, entity_level="plot")

    @action(detail=True, methods=["get"], url_path="export-financial-report")
    def export_financial_report(self, request, project_pk=None, pk=None):
        plot = self.get_object()
        if not plot:
            return Response({"detail": "Plot not found."}, status=status.HTTP_404_NOT_FOUND)
        if not can_view_finance(request.user, plot):
            raise PermissionDenied("You do not have permission to view or export financial reports for this plot.")

        expenses = Expense.objects.filter(
            db_Q(plot=plot) |
            db_Q(work_item__construction_plot=plot) |
            db_Q(job_item__work_item__construction_plot=plot),
            is_deleted=False
        ).select_related(
            "cost_code", "work_item", "job_item", "job_item__work_item"
        ).order_by("incurred_at", "created_at")

        budget = getattr(plot, "plot_budget", None)
        allocated = budget.allocated_amount if budget else Decimal("0.00")
        has_budget = allocated > 0
        spent = plot.spent_amount
        remaining = allocated - spent if has_budget else None
        currency = budget.currency if budget else "NGN"

        plot_label = plot.plot_name or plot.address
        work_items_qs = plot.workitem_set.all()

        itemized_sheet_title = "Itemized Expenses"
        itemized_headers = ["Date", "Work Item", "Job Item", "Artisan", "Amount Paid"]
        itemized_rows_xlsx = []
        itemized_rows_pdf = []
        for exp in expenses:
            d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
            w_str = (
                exp.work_item.name if exp.work_item else
                exp.job_item.work_item.name if exp.job_item else
                "Plot-level"
            )
            j_str = exp.job_item.job_name if exp.job_item else "General"
            artisan_str = get_artisan_name(exp.job_item)

            itemized_rows_xlsx.append([d_str, w_str, j_str, artisan_str, float(exp.amount)])
            itemized_rows_pdf.append([d_str, w_str, j_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])

        if request.GET.get("format") == "xlsx":
            header_title = f"Financial Report: {plot_label}"
            metadata_pairs = [
                ("Project:", plot.construction_project.project_name),
                ("Generated:", datetime.date.today().isoformat()),
                ("Currency:", currency)
            ]
            summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
            summary_values = [
                float(allocated) if has_budget else "N/A",
                float(spent),
                float(remaining) if has_budget and remaining is not None else "N/A",
                f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
            ]
            breakdown_title = "Work Items Breakdown"
            breakdown_headers = ["Work Item", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
            breakdown_rows = []
            for wi in work_items_qs:
                w_budget = getattr(wi, "work_item_budget", None)
                w_alloc = w_budget.allocated_amount if w_budget else Decimal("0.00")
        # Breakdown tables for Plot Scope: Work Items Breakdown & Jobs Breakdown
        # 1. Work Items Breakdown
        work_items_qs = plot.workitem_set.all()
        work_headers_xlsx = ["Work Item", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
        work_headers_pdf = ["Work Item", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Remaining", "Utilization"]
        work_rows_xlsx = []
        work_rows_pdf = []
        for wi in work_items_qs:
            w_budget = getattr(wi, "work_item_budget", None)
            w_alloc = w_budget.allocated_amount if w_budget else Decimal("0.00")
            w_has_b = w_alloc > 0
            w_spent = wi.spent_amount
            w_rem = w_alloc - w_spent if w_has_b else None
            w_rate = f"{(w_spent / w_alloc * 100):.1f}%" if w_has_b else "N/A"
            s_date = wi.start_date.isoformat() if hasattr(wi.start_date, "isoformat") else str(wi.start_date)
            e_date = wi.target_end_date.isoformat() if hasattr(wi.target_end_date, "isoformat") else str(wi.target_end_date)

            work_rows_xlsx.append([wi.name, s_date, e_date, float(w_alloc) if w_has_b else "N/A", float(w_spent), float(w_rem) if w_has_b and w_rem is not None else "N/A", w_rate])
            work_rows_pdf.append([wi.name, s_date, e_date, f"{currency} {w_alloc:,.2f}" if w_has_b else "N/A", f"{currency} {w_spent:,.2f}", f"{currency} {w_rem:,.2f}" if w_has_b and w_rem is not None else "N/A", w_rate])

        # 2. Job Items Breakdown
        job_items_qs = JobItem.objects.filter(work_item__construction_plot=plot).select_related("work_item")
        job_headers_xlsx = ["Job Item", "Work Item", "Artisan", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Utilization"]
        job_headers_pdf = ["Job Item", "Work Item", "Artisan", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Utilization"]
        job_rows_xlsx = []
        job_rows_pdf = []
        for ji in job_items_qs:
            j_budget = getattr(ji, "job_item_budget", None)
            j_alloc = j_budget.allocated_amount if j_budget else Decimal("0.00")
            j_has_b = j_alloc > 0
            j_spent = ji.spent_amount
            j_rate = f"{(j_spent / j_alloc * 100):.1f}%" if j_has_b else "N/A"
            s_date = ji.start_date.isoformat() if hasattr(ji.start_date, "isoformat") else str(ji.start_date)
            e_date = ji.target_end_date.isoformat() if hasattr(ji.target_end_date, "isoformat") else str(ji.target_end_date)
            artisan_str = get_artisan_name(ji)

            job_rows_xlsx.append([ji.job_name, ji.work_item.name, artisan_str, s_date, e_date, float(j_alloc) if j_has_b else "N/A", float(j_spent), j_rate])
            job_rows_pdf.append([ji.job_name, ji.work_item.name, artisan_str, s_date, e_date, f"{currency} {j_alloc:,.2f}" if j_has_b else "N/A", f"{currency} {j_spent:,.2f}", j_rate])

        xlsx_breakdowns = [
            ("Work Items Breakdown", work_headers_xlsx, work_rows_xlsx),
            ("Jobs Breakdown", job_headers_xlsx, job_rows_xlsx),
        ]

        pdf_breakdowns = [
            ("Work Items Breakdown", work_headers_pdf, work_rows_pdf, [120, 65, 65, 75, 75, 75, 57]),
            ("Jobs Breakdown", job_headers_pdf, job_rows_pdf, [95, 95, 75, 60, 60, 55, 55, 37]),
        ]

        if request.GET.get("format") == "xlsx":
            header_title = f"Financial Report: {plot_label}"
            metadata_pairs = [
                ("Project:", plot.construction_project.project_name),
                ("Generated:", datetime.date.today().isoformat()),
                ("Currency:", currency)
            ]
            summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
            summary_values = [
                float(allocated) if has_budget else "N/A",
                float(spent),
                float(remaining) if has_budget and remaining is not None else "N/A",
                f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
            ]
            filename = f"financial_report_plot_{plot.id}_{datetime.date.today().isoformat()}.xlsx"
            return build_financial_report_excel(
                header_title, metadata_pairs, summary_headers, summary_values,
                itemized_sheet_title=itemized_sheet_title,
                itemized_headers=itemized_headers,
                itemized_rows=itemized_rows_xlsx,
                filename=filename,
                breakdowns=xlsx_breakdowns
            )

        # PDF output
        title = f"Financial Report: {plot_label}"
        metadata_lines = [
            f"Project: {plot.construction_project.project_name}",
            f"Generated: {datetime.date.today().isoformat()} | Currency: {currency}"
        ]
        summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
        summary_values = [
            f"{currency} {allocated:,.2f}" if has_budget else "N/A",
            f"{currency} {spent:,.2f}",
            f"{currency} {remaining:,.2f}" if has_budget and remaining is not None else "N/A",
            f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
        ]
        itemized_heading = "Itemized Expenditures"
        filename = f"financial_report_plot_{plot.id}_{datetime.date.today().isoformat()}.pdf"
        return build_financial_report_pdf(
            title, metadata_lines, summary_headers, summary_values, [130, 130, 130, 130],
            itemized_heading=itemized_heading,
            itemized_headers=itemized_headers,
            itemized_rows=itemized_rows_pdf[:80],
            itemized_col_widths=[75, 120, 130, 100, 107],
            filename=filename,
            breakdowns=pdf_breakdowns
        )


# ---------------------------------------------------------------------------
# WorkItem ViewSet
# ---------------------------------------------------------------------------

class WorkItemViewSet(PlotScopedMixin, viewsets.ModelViewSet):
    """Nested under /projects/{project_pk}/plots/{plot_pk}/workitems/"""
    serializer_class = WorkItemSerializer
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer, XLSXRenderer, PDFRenderer]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "export_reports", "export_financial_report"):
            return [IsAuthenticated(), IsPlotMember()]
        if self.action == "create":
            return [IsAuthenticated(), CanCreateWorkItem()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), CanUpdateWorkItem()]
        if self.action == "destroy":
            return [IsAuthenticated(), CanDeleteWorkItem()]
        if self.action in ("approve", "reject"):
            return [IsAuthenticated(), CanApproveWorkItem()]
        if self.action in ("images", "delete_image"):
            if self.request.method == "GET":
                return [IsAuthenticated(), IsPlotMember()]
            return [IsAuthenticated(), CanUpdateWorkItem()]
        return [IsAuthenticated(), CanManagePlot()]

    def get_queryset(self):
        if self.action in ("export_reports", "export_financial_report"):
            return WorkItem.objects.all()

        plot = self.get_plot()
        user = self.request.user

        if plot:
            role = get_plot_role(user, plot)
            qs = WorkItem.objects.filter(construction_plot=plot)
            # Only PM, Owner, and Creator see unapproved items
            if role not in {"owner", "project_manager"}:
                qs = qs.filter(db_Q(is_approved=True) | db_Q(created_by=user))
            return qs.order_by('-updated_at')

        # Global access — restrict unapproved items for limited roles
        base_qs = WorkItem.objects.filter(
            db_Q(construction_plot__construction_project__created_by=user) |
            db_Q(construction_plot__construction_project__client=user) |
            db_Q(construction_plot__construction_project__project_manager=user) |
            db_Q(construction_plot__construction_project__consultants=user) |
            db_Q(construction_plot__foremen=user) |
            db_Q(construction_plot__foremen=user)
        ).distinct()

        # Filter unapproved items unless user is PM/owner or created it
        can_see_unapproved = (
            db_Q(construction_plot__construction_project__created_by=user) |
            db_Q(construction_plot__construction_project__project_manager=user) |
            db_Q(created_by=user)
        )
        return base_qs.filter(
            db_Q(is_approved=True) | can_see_unapproved
        ).order_by('-updated_at')

    def perform_update(self, serializer):
        work_item = self.get_object()
        user = self.request.user
        role = get_plot_role(user, work_item.construction_plot)

        if role == "foreman":
            updated_work_item = serializer.save(is_approved=False)
            project = updated_work_item.construction_plot.construction_project
            # Notify PM/Owner about the update requiring approval
            recipients = {project.project_manager, project.created_by}
            notifications = [
                Notification(
                    user=pm,
                    project=project,
                    message=(
                        f"Approval required: {user.username} updated work item "
                        f"'{updated_work_item.name}' in plot {updated_work_item.construction_plot.address}"
                    ),
                    priority=Notification.Priority.HIGH,
                    target_url=f"/plots/{updated_work_item.construction_plot.pk}/work-items/{updated_work_item.pk}/"
                )
                for pm in recipients if pm
            ]
            if notifications:
                Notification.objects.bulk_create(notifications)
        else:
            serializer.save()

    def perform_create(self, serializer):
        plot = self.get_plot()
        if not plot:
            plot_id = self.request.data.get("construction_plot")
            if plot_id:
                plot = ConstructionPlot.objects.filter(pk=plot_id).first()
        if not plot:
            raise ValidationError({"construction_plot": "Construction plot is required."})
        if plot.status == 'Completed':
            raise ValidationError("Cannot add work items to a completed plot.")

        user = self.request.user
        role = get_plot_role(user, plot)

        # Foreman-created items start unapproved; PM/owner items are auto-approved
        is_approved = role in {"owner", "project_manager"}
        work_item = serializer.save(construction_plot=plot, is_approved=is_approved, created_by=user)

        project = work_item.construction_plot.construction_project

        if not is_approved:
            # Notify PM that an unapproved user submitted a work item for approval
            recipients = [project.project_manager, project.created_by]
            notifications = [
                Notification(
                    user=pm,
                    project=project,
                    message=(
                        f"Approval required: {user.username} submitted work item "
                        f"'{work_item.name}' in plot {plot.address}"
                    ),
                    priority=Notification.Priority.HIGH,
                    target_url=f"/plots/{plot.pk}/work-items/{work_item.pk}/"
                )
                for pm in recipients if pm
            ]
            Notification.objects.bulk_create(notifications)
        else:
            # Notify all project members of the new work item
            members = set([project.created_by, project.client, project.project_manager])
            members.update(project.consultants.all())
            for p in project.constructionplot_set.all():
                for f in p.foremen.all():
                    members.add(f)
            notifications = [
                Notification(
                    user=member,
                    project=project,
                    message=f"New work item '{work_item.name}' added to plot {plot.address}",
                    priority=Notification.Priority.NORMAL
                )
                for member in members if member and member != user
            ]
            Notification.objects.bulk_create(notifications)

    @action(detail=True, methods=["post"])
    def approve(self, request, **kwargs):
        """POST …/workitems/{pk}/approve/ — only project_manager."""
        work_item = self.get_object()
        self.check_object_permissions(request, work_item)
        work_item.is_approved = True
        work_item.save()

        plot = work_item.construction_plot
        project = plot.construction_project
        message_opt = request.data.get("message", request.data.get("reason", ""))
        base_msg = f"Your work item '{work_item.name}' has been approved by the PM."
        if message_opt:
            base_msg += f" Message: {message_opt}"

        # Notify the creator and foremen
        users_to_notify = set(plot.foremen.all())
        if work_item.created_by:
            users_to_notify.add(work_item.created_by)
            
        for u in users_to_notify:
            Notification.objects.create(
                user=u,
                project=project,
                message=base_msg,
                priority=Notification.Priority.NORMAL,
                target_url=f"/plots/{plot.pk}/work-items/{work_item.pk}/"
            )
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, **kwargs):
        """POST …/workitems/{pk}/reject/ — only project_manager."""
        work_item = self.get_object()
        self.check_object_permissions(request, work_item)
        work_item.is_approved = False
        work_item.save()

        plot = work_item.construction_plot
        project = plot.construction_project
        reason = request.data.get("message", request.data.get("reason", ""))
        message = f"Your work item '{work_item.name}' was rejected by the PM."
        if reason:
            message += f" Reason: {reason}"
            
        # Notify the creator and foremen
        users_to_notify = set(plot.foremen.all())
        if work_item.created_by:
            users_to_notify.add(work_item.created_by)
            
        for u in users_to_notify:
            Notification.objects.create(
                user=u,
                project=project,
                message=message,
                priority=Notification.Priority.HIGH,
                target_url=f"/plots/{plot.pk}/work-items/{work_item.pk}/"
            )
        return Response({"status": "rejected"})

    @action(detail=True, methods=["post", "get", "delete"], url_path="images")
    def images(self, request, **kwargs):
        """GET/POST/DELETE images for a work item. POST expects multipart/form-data."""
        work_item = self.get_object()
        if request.method == "GET":
            from .serializers import WorkItemImageSerializer
            pics = list(work_item.photos.all())
            if work_item.work_item_image and work_item.work_item_image not in pics:
                pics.insert(0, work_item.work_item_image)
            return Response(WorkItemImageSerializer(pics, many=True, context=self.get_serializer_context()).data)

        if request.method == "DELETE":
            image_id = request.data.get("image_id") or request.query_params.get("image_id")
            if not image_id:
                return Response({"detail": "image_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            return self._remove_image_from_work_item(work_item, image_id)

        # POST
        file_obj = request.FILES.get("img") or request.FILES.get("image")
        if not file_obj:
            return Response({"detail": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)
        caption = request.data.get("caption") or request.data.get("description", "")
        upload_to = request.data.get("upload_to") or getattr(work_item, "upload_to", work_item.default_upload_to)
        pic = Picture.objects.create(
            img=file_obj,
            description=caption,
            upload_to=upload_to
        )
        work_item.photos.add(pic)
        if not work_item.work_item_image:
            work_item.work_item_image = pic
            work_item.save(update_fields=["work_item_image"])
        from .serializers import WorkItemImageSerializer
        return Response(WorkItemImageSerializer(pic, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>[^/.]+)")
    def delete_image(self, request, image_id=None, **kwargs):
        """DELETE a specific image from a work item."""
        work_item = self.get_object()
        return self._remove_image_from_work_item(work_item, image_id)

    def _remove_image_from_work_item(self, work_item, image_id):
        try:
            pic = Picture.objects.get(pk=image_id)
        except (Picture.DoesNotExist, ValueError):
            return Response({"detail": "Image not found."}, status=status.HTTP_404_NOT_FOUND)

        is_in_photos = work_item.photos.filter(pk=pic.pk).exists()
        is_cover = (work_item.work_item_image_id == pic.pk)

        if not is_in_photos and not is_cover:
            return Response({"detail": "Image not found on this work item."}, status=status.HTTP_404_NOT_FOUND)

        if is_in_photos:
            work_item.photos.remove(pic)

        if is_cover:
            next_pic = work_item.photos.first()
            work_item.work_item_image = next_pic
            work_item.save(update_fields=["work_item_image"])

        pic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


    @action(detail=True, methods=["get"], url_path="export-financial-report")
    def export_financial_report(self, request, **kwargs):
        """GET …/workitems/{pk}/export-financial-report/ — PDF financial report."""
        work_item = self.get_object()
        plot = work_item.construction_plot
        if not can_view_finance(request.user, work_item):
            raise PermissionDenied("You do not have permission to view or export financial reports for this work item.")

        expenses = Expense.objects.filter(
            db_Q(work_item=work_item) | db_Q(job_item__work_item=work_item),
            is_deleted=False
        ).select_related("cost_code", "job_item").order_by("incurred_at", "created_at")

        budget = getattr(work_item, "work_item_budget", None)
        allocated = budget.allocated_amount if budget else Decimal("0.00")
        has_budget = allocated > 0
        spent = work_item.spent_amount
        remaining = allocated - spent if has_budget else None
        currency = budget.currency if budget else "NGN"

        job_items_qs = work_item.job_items.all()

        itemized_sheet_title = "Itemized Expenses"
        itemized_headers = ["Date", "Job Item", "Artisan", "Amount Paid"]
        itemized_rows_xlsx = []
        itemized_rows_pdf = []
        for exp in expenses:
            d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
            j_str = exp.job_item.job_name if exp.job_item else "Work item level"
            artisan_str = get_artisan_name(exp.job_item)

            itemized_rows_xlsx.append([d_str, j_str, artisan_str, float(exp.amount)])
            itemized_rows_pdf.append([d_str, j_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])

        if request.GET.get("format") == "xlsx":
            header_title = f"Financial Report: {work_item.name}"
            metadata_pairs = [
                ("Plot:", plot.plot_name or plot.address),
                ("Project:", plot.construction_project.project_name),
                ("Generated:", datetime.date.today().isoformat()),
                ("Currency:", currency)
            ]
            summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
            summary_values = [
                float(allocated) if has_budget else "N/A",
                float(spent),
                float(remaining) if has_budget and remaining is not None else "N/A",
                f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
            ]
        # Breakdown tables for Work Item Scope: Jobs Breakdown
        job_headers_xlsx = ["Job Item", "Artisan", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Utilization"]
        job_headers_pdf = ["Job Item", "Artisan", "Start Date", "End Date", "Allocated Budget", "Total Spent", "Utilization"]
        job_rows_xlsx = []
        job_rows_pdf = []
        for ji in job_items_qs:
            j_budget = getattr(ji, "job_item_budget", None)
            j_alloc = j_budget.allocated_amount if j_budget else Decimal("0.00")
            j_has_b = j_alloc > 0
            j_spent = ji.spent_amount
            j_rate = f"{(j_spent / j_alloc * 100):.1f}%" if j_has_b else "N/A"
            s_date = ji.start_date.isoformat() if hasattr(ji.start_date, "isoformat") else str(ji.start_date)
            e_date = ji.target_end_date.isoformat() if hasattr(ji.target_end_date, "isoformat") else str(ji.target_end_date)
            artisan_str = get_artisan_name(ji)

            job_rows_xlsx.append([ji.job_name, artisan_str, s_date, e_date, float(j_alloc) if j_has_b else "N/A", float(j_spent), j_rate])
            job_rows_pdf.append([ji.job_name, artisan_str, s_date, e_date, f"{currency} {j_alloc:,.2f}" if j_has_b else "N/A", f"{currency} {j_spent:,.2f}", j_rate])

        xlsx_breakdowns = [
            ("Jobs Breakdown", job_headers_xlsx, job_rows_xlsx),
        ]

        pdf_breakdowns = [
            ("Jobs Breakdown", job_headers_pdf, job_rows_pdf, [120, 85, 60, 60, 70, 70, 67]),
        ]

        if request.GET.get("format") == "xlsx":
            header_title = f"Financial Report: {work_item.name}"
            metadata_pairs = [
                ("Plot:", plot.plot_name or plot.address),
                ("Project:", plot.construction_project.project_name),
                ("Generated:", datetime.date.today().isoformat()),
                ("Currency:", currency)
            ]
            summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
            summary_values = [
                float(allocated) if has_budget else "N/A",
                float(spent),
                float(remaining) if has_budget and remaining is not None else "N/A",
                f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
            ]
            filename = f"financial_report_workitem_{work_item.id}_{datetime.date.today().isoformat()}.xlsx"
            return build_financial_report_excel(
                header_title, metadata_pairs, summary_headers, summary_values,
                itemized_sheet_title=itemized_sheet_title,
                itemized_headers=itemized_headers,
                itemized_rows=itemized_rows_xlsx,
                filename=filename,
                breakdowns=xlsx_breakdowns
            )

        # PDF output
        title = f"Financial Report: {work_item.name}"
        metadata_lines = [
            f"Plot: {plot.plot_name or plot.address}",
            f"Project: {plot.construction_project.project_name}",
            f"Generated: {datetime.date.today().isoformat()} | Currency: {currency}"
        ]
        summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
        summary_values = [
            f"{currency} {allocated:,.2f}" if has_budget else "N/A",
            f"{currency} {spent:,.2f}",
            f"{currency} {remaining:,.2f}" if has_budget and remaining is not None else "N/A",
            f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
        ]
        itemized_heading = "Itemized Expenditures"
        filename = f"financial_report_workitem_{work_item.id}_{datetime.date.today().isoformat()}.pdf"
        return build_financial_report_pdf(
            title, metadata_lines, summary_headers, summary_values, [130, 130, 130, 130],
            itemized_heading=itemized_heading,
            itemized_headers=itemized_headers,
            itemized_rows=itemized_rows_pdf[:80],
            itemized_col_widths=[85, 170, 140, 137],
            filename=filename,
            breakdowns=pdf_breakdowns
        )

    @action(detail=True, methods=["get"], url_path="reports")
    def reports(self, request, **kwargs):
        work_item = self.get_object()
        plot = work_item.construction_plot
        role = get_plot_role(request.user, plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to view reports on this work item.")
        qs = JobReport.objects.filter(
            job_item__work_item=work_item
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by('-report_date')
        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="export-reports")
    def export_reports(self, request, **kwargs):
        """GET …/workitems/{pk}/export-reports/ — PDF daily progress report for a work item."""
        work_item = self.get_object()
        plot = work_item.construction_plot
        role = get_plot_role(request.user, plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to export reports on this work item.")

        start_date, end_date = parse_report_date_range(request)
        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = JobReport.objects.filter(
            job_item__work_item=work_item,
            report_date__gte=start_date,
            report_date__lte=end_date,
        ).select_related("reported_by", "job_item", "job_item__work_item").prefetch_related("photos").order_by('report_date')

        title = f"Work Item Report: {work_item.name}"
        metadata_lines = [
            f"Plot: {plot.plot_name or plot.address} | Project: {plot.construction_project.project_name}",
            f"Date range: {start_date.isoformat()} — {end_date.isoformat()}"
        ]
        filename = f"workitem_{work_item.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        if request.GET.get("format") == "xlsx":
            filename = f"workitem_{work_item.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.xlsx"
            return build_progress_report_excel(title, metadata_lines, queryset, filename)

        return build_progress_report_pdf(title, metadata_lines, queryset, filename, entity_level="workitem")


# ---------------------------------------------------------------------------
# JobItem ViewSet
# ---------------------------------------------------------------------------

class JobItemViewSet(PlotScopedMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/
    """
    serializer_class = JobItemSerializer
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer, XLSXRenderer, PDFRenderer]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "export_reports", "export_financial_report"):
            return [IsAuthenticated(), IsPlotMember()]
        if self.action == "create":
            return [IsAuthenticated(), CanCreateJobItem()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), CanUpdateJobItem()]
        if self.action == "destroy":
            return [IsAuthenticated(), CanDeleteJobItem()]
        if self.action in ("approve", "reject"):
            return [IsAuthenticated(), CanApproveJobItem()]
        return [IsAuthenticated(), CanManagePlot()]

    def get_queryset(self):
        if self.action in ("export_reports", "export_financial_report"):
            return JobItem.objects.all()

        plot = self.get_plot()
        user = self.request.user
        query_params = (
            getattr(self.request, "query_params", getattr(self.request, "GET", {}))
            if hasattr(self, "request") and self.request
            else {}
        )
        wi_pk = (
            self.kwargs.get("workitem_pk") or
            query_params.get("work_item") or
            query_params.get("workitem") or
            query_params.get("work_item_id")
        )

        if plot and wi_pk:
            role = get_plot_role(user, plot)
            qs = JobItem.objects.filter(
                work_item__construction_plot=plot,
                work_item__pk=wi_pk,
            )
            # Only PM, Owner, and Creator see unapproved items
            if role not in {"owner", "project_manager"}:
                qs = qs.filter(db_Q(is_approved=True) | db_Q(created_by=user))
            return qs.order_by('-updated_at')

        if plot:
            role = get_plot_role(user, plot)
            qs = JobItem.objects.filter(work_item__construction_plot=plot)
            if role not in {"owner", "project_manager"}:
                qs = qs.filter(db_Q(is_approved=True) | db_Q(created_by=user))
            return qs.order_by('-updated_at')

        # Global access — restrict unapproved for limited roles
        base_qs = JobItem.objects.filter(
            db_Q(work_item__construction_plot__construction_project__created_by=user) |
            db_Q(work_item__construction_plot__construction_project__client=user) |
            db_Q(work_item__construction_plot__construction_project__project_manager=user) |
            db_Q(work_item__construction_plot__construction_project__consultants=user) |
            db_Q(work_item__construction_plot__foremen=user)
        ).distinct()

        can_see_unapproved = (
            db_Q(work_item__construction_plot__construction_project__created_by=user) |
            db_Q(work_item__construction_plot__construction_project__project_manager=user) |
            db_Q(created_by=user)
        )
        qs = base_qs.filter(
            db_Q(is_approved=True) | can_see_unapproved
        )
        if wi_pk:
            qs = qs.filter(work_item__pk=wi_pk)
        return qs.order_by('-updated_at')

    def perform_update(self, serializer):
        job_item = self.get_object()
        user = self.request.user
        role = get_plot_role(user, job_item.work_item.construction_plot)

        if role == "foreman":
            updated_job_item = serializer.save(is_approved=False)
            project = updated_job_item.work_item.construction_plot.construction_project
            # Notify PM/Owner about the update requiring approval
            recipients = {project.project_manager, project.created_by}
            notifications = [
                Notification(
                    user=pm,
                    project=project,
                    message=(
                        f"Approval required: {user.username} updated job item "
                        f"'{updated_job_item.job_name}' in work item {updated_job_item.work_item.name}"
                    ),
                    priority=Notification.Priority.HIGH,
                    target_url=f"/job-items/{updated_job_item.pk}/"
                )
                for pm in recipients if pm
            ]
            if notifications:
                Notification.objects.bulk_create(notifications)
        else:
            serializer.save()

    def perform_create(self, serializer):
        plot = self.get_plot()
        user = self.request.user
        work_item = get_object_or_404(
            WorkItem,
            pk=self.kwargs["workitem_pk"],
            construction_plot=plot,
        )
        if work_item.work_status == 'Completed':
            raise ValidationError("Cannot add job items to a completed work item.")
        if not work_item.is_approved:
            raise ValidationError("Cannot add job items to an unapproved work item.")

        role = get_plot_role(user, plot)
        is_approved = role in {"owner", "project_manager"}
        job_item = serializer.save(work_item=work_item, is_approved=is_approved, created_by=user)

        project = work_item.construction_plot.construction_project
        role = get_plot_role(user, plot)

        if not is_approved:
            # Notify PM that an unapproved user added a job item
            recipients = [project.project_manager, project.created_by]
            notifications = [
                Notification(
                    user=pm,
                    project=project,
                    message=(
                        f"Approval required: {user.username} submitted job item '{job_item.job_name}' "
                        f"({job_item.job_artisan}) to work item '{work_item.name}'"
                    ),
                    priority=Notification.Priority.HIGH,
                    target_url=f"/job-items/{job_item.pk}/"
                )
                for pm in recipients if pm
            ]
            Notification.objects.bulk_create(notifications)
        else:
            # Notify plot foreman and stakeholders
            members = set([project.created_by, project.client, project.project_manager])
            for f in plot.foremen.all():
                members.add(f)
            notifications = [
                Notification(
                    user=m,
                    project=project,
                    message=f"New job item '{job_item.job_name}' assigned to {job_item.job_artisan}",
                    priority=Notification.Priority.NORMAL,
                    target_url=f"/job-items/{job_item.pk}/"
                ) for m in members if m and m != user
            ]
            Notification.objects.bulk_create(notifications)

    @action(detail=True, methods=["post"])
    def approve(self, request, **kwargs):
        """POST …/jobitems/{pk}/approve/ — only project_manager."""
        job_item = self.get_object()
        self.check_object_permissions(request, job_item)
        job_item.is_approved = True
        job_item.save()

        plot = job_item.work_item.construction_plot
        project = plot.construction_project
        message_opt = request.data.get("message", request.data.get("reason", ""))
        base_msg = f"Your job item '{job_item.job_name}' has been approved by the PM."
        if message_opt:
            base_msg += f" Message: {message_opt}"
            
        users_to_notify = set(plot.foremen.all())
        if job_item.created_by:
            users_to_notify.add(job_item.created_by)
            
        for u in users_to_notify:
            Notification.objects.create(
                user=u,
                project=project,
                message=base_msg,
                priority=Notification.Priority.NORMAL,
                target_url=f"/job-items/{job_item.pk}/"
            )
        return Response({"status": "approved"})

    @action(detail=True, methods=["post"])
    def reject(self, request, **kwargs):
        """POST …/jobitems/{pk}/reject/ — only project_manager."""
        job_item = self.get_object()
        self.check_object_permissions(request, job_item)
        job_item.is_approved = False
        job_item.save()

        plot = job_item.work_item.construction_plot
        project = plot.construction_project
        reason = request.data.get("message", request.data.get("reason", ""))
        message = f"Your job item '{job_item.job_name}' was rejected by the PM."
        if reason:
            message += f" Reason: {reason}"
            
        users_to_notify = set(plot.foremen.all())
        if job_item.created_by:
            users_to_notify.add(job_item.created_by)
            
        for u in users_to_notify:
            Notification.objects.create(
                user=u,
                project=project,
                message=message,
                priority=Notification.Priority.HIGH,
                target_url=f"/job-items/{job_item.pk}/"
            )
        return Response({"status": "rejected"})

    @action(detail=True, methods=["get"], url_path="export-financial-report")
    def export_financial_report(self, request, **kwargs):
        """GET …/jobitems/{pk}/export-financial-report/ — PDF financial report."""
        job_item = self.get_object()
        plot = job_item.work_item.construction_plot
        if not can_view_finance(request.user, job_item):
            raise PermissionDenied("You do not have permission to view or export financial reports for this job item.")

        expenses = Expense.objects.filter(
            job_item=job_item, is_deleted=False
        ).select_related("cost_code", "job_item").order_by("incurred_at", "created_at")

        budget = getattr(job_item, "job_item_budget", None)
        allocated = budget.allocated_amount if budget else Decimal("0.00")
        has_budget = allocated > 0
        spent = job_item.spent_amount
        remaining = allocated - spent if has_budget else None
        currency = budget.currency if budget else "NGN"

        itemized_sheet_title = "Itemized Expenses"
        itemized_headers = ["Date", "Artisan", "Amount Paid"]
        itemized_rows_xlsx = []
        itemized_rows_pdf = []
        for exp in expenses:
            d_str = exp.incurred_at.isoformat() if hasattr(exp.incurred_at, "isoformat") else str(exp.incurred_at)
            artisan_str = get_artisan_name(exp.job_item)

            itemized_rows_xlsx.append([d_str, artisan_str, float(exp.amount)])
            itemized_rows_pdf.append([d_str, artisan_str, f"{exp.currency} {exp.amount:,.2f}"])

        if request.GET.get("format") == "xlsx":
            header_title = f"Financial Report: {job_item.job_name}"
            metadata_pairs = [
                ("Work Item:", job_item.work_item.name),
                ("Plot:", plot.plot_name or plot.address),
                ("Project:", plot.construction_project.project_name),
                ("Artisan:", get_artisan_name(job_item)),
                ("Status:", job_item.job_status),
                ("Generated:", datetime.date.today().isoformat()),
                ("Currency:", currency)
            ]
            summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
            summary_values = [
                float(allocated) if has_budget else "N/A",
                float(spent),
                float(remaining) if has_budget and remaining is not None else "N/A",
                f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
            ]
            filename = f"financial_report_jobitem_{job_item.id}_{datetime.date.today().isoformat()}.xlsx"
            return build_financial_report_excel(
                header_title, metadata_pairs, summary_headers, summary_values,
                None, None, [], itemized_sheet_title, itemized_headers, itemized_rows_xlsx, filename
            )

        # PDF output
        title = f"Financial Report: {job_item.job_name}"
        metadata_lines = [
            f"Work Item: {job_item.work_item.name}",
            f"Plot: {plot.plot_name or plot.address}",
            f"Project: {plot.construction_project.project_name}",
            f"Artisan: {get_artisan_name(job_item)} | Status: {job_item.job_status}",
            f"Generated: {datetime.date.today().isoformat()} | Currency: {currency}"
        ]
        summary_headers = ["Allocated Budget", "Total Expenditures", "Remaining Budget", "Budget Utilization"]
        summary_values = [
            f"{currency} {allocated:,.2f}" if has_budget else "N/A",
            f"{currency} {spent:,.2f}",
            f"{currency} {remaining:,.2f}" if has_budget and remaining is not None else "N/A",
            f"{(spent / allocated * 100):.1f}%" if has_budget else "N/A"
        ]
        itemized_heading = "Itemized Expenditures"
        filename = f"financial_report_jobitem_{job_item.id}_{datetime.date.today().isoformat()}.pdf"
        return build_financial_report_pdf(
            title, metadata_lines, summary_headers, summary_values, [130, 130, 130, 130],
            None, None, [], None,
            itemized_heading, itemized_headers, itemized_rows_pdf[:80], [120, 230, 182],
            filename
        )

    @action(detail=True, methods=["get"], url_path="export-reports")
    def export_reports(self, request, **kwargs):
        """GET …/jobitems/{pk}/export-reports/ — PDF daily progress report for a job item."""
        job_item = self.get_object()
        plot = job_item.work_item.construction_plot
        role = get_plot_role(request.user, plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to export reports on this job item.")

        start_date, end_date = parse_report_date_range(request)
        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = JobReport.objects.filter(
            job_item=job_item,
            report_date__gte=start_date,
            report_date__lte=end_date
        ).select_related("reported_by", "job_item", "job_item__work_item").prefetch_related("photos").order_by('report_date')

        title = f"Job Item Report: {job_item.job_name}"
        metadata_lines = [
            f"Work Item: {job_item.work_item.name} | Plot: {plot.plot_name or plot.address}",
            f"Project: {plot.construction_project.project_name}",
            f"Artisan: {job_item.job_artisan or '—'} | Status: {job_item.job_status}",
            f"Date range: {start_date.isoformat()} — {end_date.isoformat()}"
        ]
        filename = f"jobitem_{job_item.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        if request.GET.get("format") == "xlsx":
            filename = f"jobitem_{job_item.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.xlsx"
            return build_progress_report_excel(title, metadata_lines, queryset, filename)

        return build_progress_report_pdf(title, metadata_lines, queryset, filename, entity_level="jobitem")


# ---------------------------------------------------------------------------
# JobReport ViewSet
# ---------------------------------------------------------------------------

class JobReportViewSet(PlotScopedMixin, viewsets.ModelViewSet):
    """
    Nested under:
    /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/{jobitem_pk}/reports/

    Extra actions
    -------------
    POST .../reports/{pk}/approve/
    POST .../reports/{pk}/reject/
    """
    serializer_class = JobReportSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsPlotMember()]
        if self.action in ("create", "update", "partial_update"):
            return [IsAuthenticated(), CanSubmitReport()]
        if self.action in ("approve", "reject"):
            return [IsAuthenticated(), CanReviewReport()]
        if self.action == "destroy":
            return [IsAuthenticated(), CanManagePlot()]
        if self.action == "comments":
            return [IsAuthenticated(), IsPlotMember()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return JobReport.objects.filter(
            job_item__work_item__construction_plot=self.get_plot(),
            job_item__pk=self.kwargs["jobitem_pk"],
        ).select_related("reported_by", "job_item").order_by('-updated_at')

    @action(detail=True, methods=["get"], url_path="export-reports")
    def export_reports(self, request, **kwargs):
        plot = self.get_plot()
        if not plot:
            return Response({"detail": "Plot not found."}, status=status.HTTP_404_NOT_FOUND)

        def parse_date(value):
            try:
                return datetime.datetime.strptime(value, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                return None

        start_date = parse_date(request.GET.get("start_date"))
        end_date = parse_date(request.GET.get("end_date"))
        if not start_date or not end_date:
            today = datetime.date.today()
            weekday = today.weekday()
            start_date = today - datetime.timedelta(days=weekday)
            end_date = start_date + datetime.timedelta(days=6)

        if start_date > end_date:
            return Response({"detail": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = JobReport.objects.filter(job_item__work_item__construction_plot=plot)
        if request.GET.get("job_item_id"):
            queryset = queryset.filter(job_item__pk=request.GET["job_item_id"])
        elif request.GET.get("work_item_id"):
            queryset = queryset.filter(job_item__work_item__pk=request.GET["work_item_id"])

        queryset = queryset.filter(report_date__gte=start_date, report_date__lte=end_date).select_related(
            "reported_by", "job_item", "job_item__work_item"
        ).prefetch_related("photos").order_by('report_date')

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph(f"Plot Report Export: {plot.address}", styles["Title"]))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Project: {plot.construction_project.project_name}", styles["Normal"]))
        story.append(Paragraph(f"Date range: {start_date.isoformat()} — {end_date.isoformat()}", styles["Normal"]))
        if request.GET.get("work_item_id"):
            story.append(Paragraph(f"Filtered by work item ID: {request.GET['work_item_id']}", styles["Normal"]))
        if request.GET.get("job_item_id"):
            story.append(Paragraph(f"Filtered by job item ID: {request.GET['job_item_id']}", styles["Normal"]))
        story.append(Spacer(1, 18))

        if not queryset.exists():
            story.append(Paragraph("No reports found for the selected scope and date range.", styles["BodyText"]))
        else:
            figures = []
            for report in queryset:
                story.append(Paragraph(f"Report Date: {report.report_date}", styles["Heading2"]))
                story.append(Paragraph(f"Job Item: {report.job_item.job_name}", styles["Heading3"]))
                story.append(Paragraph(f"Work Item: {report.job_item.work_item.name}", styles["Normal"]))
                story.append(Paragraph(f"Reported by: {report.reported_by.display_name or report.reported_by.username}", styles["Normal"]))
                story.append(Paragraph(f"Priority: {report.priority}", styles["Normal"]))
                story.append(Paragraph(f"Status: {report.report_status}", styles["Normal"]))
                story.append(Paragraph(f"Completion: {report.percentage_job_progress}%", styles["Normal"]))
                story.append(Paragraph(f"Expected completion: {report.expected_completion_date}", styles["Normal"]))
                story.append(Spacer(1, 8))

                pics = list(report.photos.all())
                if report.job_image and report.job_image not in pics:
                    pics.insert(0, report.job_image)
                fig_refs = []
                for p in pics:
                    fig_num = len(figures) + 1
                    caption = f"{report.job_item.job_name} ({report.report_date})"
                    if p.description:
                        caption += f" - {p.description}"
                    figures.append((fig_num, p, caption))
                    fig_refs.append(f"Fig. {fig_num}")

                notes_val = report.notes or "—"
                if fig_refs:
                    ref_str = f" (see {', '.join(fig_refs)})"
                    notes_val = f"{notes_val}{ref_str}" if notes_val != "—" else f"see {', '.join(fig_refs)}"

                report_table_data = [
                    ["Field", "Value"],
                    ["Notes & Evidence", notes_val],
                    ["External comments", report.external_comments or "—"],
                    ["Internal comments", report.internal_comments or "—"],
                    ["Days elapsed", report.days_elapsed if report.days_elapsed is not None else "—"],
                ]
                table = Table(report_table_data, colWidths=[130, 340])
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.whitesmoke),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ]))
                story.append(table)
                story.append(Spacer(1, 14))

            if figures:
                story.append(Spacer(1, 15))
                story.append(Paragraph("Attached Photographic Figures", styles["Heading2"]))
                story.append(Paragraph("Photos referenced in reports above:", styles["Normal"]))
                story.append(Spacer(1, 8))
                fig_table = _build_figures_table(figures, styles)
                if fig_table:
                    story.append(fig_table)

        doc.build(story)
        buffer.seek(0)
        filename = f"plot_{plot.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)

    def _notify_report_comment(self, report, comment):
        project = report.job_item.work_item.construction_plot.construction_project
        plot = report.job_item.work_item.construction_plot
        members = set([project.created_by, project.client, project.project_manager])
        members.update(project.consultants.all())
        for f in plot.foremen.all():
            members.add(f)
        members.discard(comment.user)

        notifications = [
            Notification(
                user=member,
                project=project,
                message=(
                    f"New comment on report for {report.job_item.job_name} "
                    f"in {report.job_item.work_item.name}"
                ),
                priority=Notification.Priority.NORMAL,
                target_url=f"/job-items/{report.job_item.pk}?report={report.pk}"
            )
            for member in members if member
        ]
        Notification.objects.bulk_create(notifications)

    def perform_create(self, serializer):
        job_item = get_object_or_404(
            JobItem,
            pk=self.kwargs["jobitem_pk"],
            work_item__construction_plot=self.get_plot(),
        )
        if not job_item.is_approved:
            raise ValidationError("Cannot add reports to an unapproved job item.")

        report = serializer.save(
            job_item=job_item, 
            reported_by=self.request.user,
            report_status="Approved"
        )
        
        # Notify stakeholders (PM and Owner)
        project = job_item.work_item.construction_plot.construction_project
        members = set([project.created_by, project.project_manager])
        
        prio = Notification.Priority.NORMAL
        if report.priority in ["Urgent", "Critical"]:
            prio = Notification.Priority.HIGH
            
        notifications = [
            Notification(
                user=m, 
                project=project, 
                message=f"New {report.priority} report for {job_item.job_name} in {job_item.work_item.name}",
                priority=prio,
                target_url=(f"/job-items/{job_item.pk}?report={report.pk}")
            ) for m in members if m and m != self.request.user
        ]
        Notification.objects.bulk_create(notifications)

    def destroy(self, request, *args, **kwargs):
        report = self.get_object()
        project = report.job_item.work_item.construction_plot.construction_project
        plot = report.job_item.work_item.construction_plot

        user = request.user
        role_project = get_project_role(user, project)
        role_plot = get_plot_role(user, plot)
        is_owner_or_pm = (
            role_project in ("owner", "project_manager") or
            role_plot in ("owner", "project_manager") or
            getattr(user, "is_superuser", False)
        )
        if not is_owner_or_pm:
            raise PermissionDenied("Only the project manager or project creator can delete a report.")

        provided_name = None
        if isinstance(request.data, dict):
            provided_name = request.data.get("job_name") or request.data.get("confirm_name")
        if not provided_name:
            provided_name = request.query_params.get("job_name")

        job_name = report.job_item.job_name
        if not provided_name or provided_name.strip() != job_name.strip():
            raise ValidationError({"job_name": f"To delete this report, you must type the exact job item name '{job_name}'."})

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, **kwargs):
        report = self.get_object()
        if request.method == "POST":
            serializer = JobReportCommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            comment = serializer.save(report=report, user=request.user)
            self._notify_report_comment(report, comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        comments = report.comments.all()
        serializer = JobReportCommentSerializer(comments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post", "get", "delete"], url_path="images")
    def images(self, request, **kwargs):
        """GET/POST/DELETE images for a daily report. POST expects multipart/form-data."""
        report = self.get_object()
        from .serializers import JobReportImageSerializer

        if request.method == "GET":
            pics = list(report.photos.all())
            if report.job_image and report.job_image not in pics:
                pics.insert(0, report.job_image)
            return Response(JobReportImageSerializer(pics, many=True, context=self.get_serializer_context()).data)

        if request.method == "DELETE":
            image_id = request.data.get("image_id") or request.query_params.get("image_id")
            if not image_id:
                return Response({"detail": "image_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            return self._remove_image_from_report(report, image_id)

        # POST
        file_obj = request.FILES.get("img") or request.FILES.get("image")
        if not file_obj:
            return Response({"detail": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)
        caption = request.data.get("caption") or request.data.get("description", "")
        upload_to = request.data.get("upload_to") or getattr(report, "upload_to", report.default_upload_to)
        pic = Picture.objects.create(
            img=file_obj,
            description=caption,
            upload_to=upload_to
        )
        report.photos.add(pic)
        if not report.job_image:
            report.job_image = pic
            report.save(update_fields=["job_image"])
        return Response(JobReportImageSerializer(pic, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>[^/.]+)")
    def delete_image(self, request, image_id=None, **kwargs):
        """DELETE a specific image from a daily report."""
        report = self.get_object()
        return self._remove_image_from_report(report, image_id)

    def _remove_image_from_report(self, report, image_id):
        try:
            pic = Picture.objects.get(pk=image_id)
        except Picture.DoesNotExist:
            return Response({"detail": "Image not found."}, status=status.HTTP_404_NOT_FOUND)

        is_linked = report.photos.filter(pk=pic.pk).exists() or (report.job_image_id == pic.id)
        if not is_linked:
            return Response({"detail": "Image does not belong to this report."}, status=status.HTTP_400_BAD_REQUEST)

        report.photos.remove(pic)
        if report.job_image_id == pic.id:
            report.job_image = report.photos.first()
            report.save(update_fields=["job_image"])

        pic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Invitation ViewSets (for responding to invitations)
# ---------------------------------------------------------------------------

class ProjectInvitationViewSet(viewsets.GenericViewSet):
    """
    Endpoints for the invitee to respond to project invitations.
    GET  /invitations/projects/              → my received project invitations
    POST /invitations/projects/{pk}/accept/
    POST /invitations/projects/{pk}/decline/
    POST /invitations/projects/{pk}/revoke/  → inviter/owner only
    """
    serializer_class = ProjectInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return ProjectInvitation.objects.filter(
            db_Q(invitee=user) | db_Q(invited_by=user)
        ).select_related("project", "invitee", "invited_by")

    def list(self, request):
        qs = self.get_queryset()
        return Response(self.get_serializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        self.check_object_permissions(request, invitation)
        try:
            accept_project_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            decline_project_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            revoke_project_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)


class PlotInvitationViewSet(viewsets.GenericViewSet):
    """
    GET  /invitations/plots/
    POST /invitations/plots/{pk}/accept/
    POST /invitations/plots/{pk}/decline/
    POST /invitations/plots/{pk}/revoke/
    """
    serializer_class = PlotInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return PlotInvitation.objects.filter(
            db_Q(invitee=user) | db_Q(invited_by=user)
        ).select_related("plot", "invitee", "invited_by")

    def list(self, request):
        qs = self.get_queryset()
        return Response(self.get_serializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            accept_plot_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            decline_plot_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            revoke_plot_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({"status": "read"})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        self.get_queryset().update(is_read=True)
        return Response({"status": "all read"})


# ---------------------------------------------------------------------------
# Document ViewSet
# ---------------------------------------------------------------------------

class DocumentViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/documents/
    Can also filter by plot via query param ?plot_id=
    """
    serializer_class = DocumentSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectMember()]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), CanManageDocuments()]
        return [IsAuthenticated()]

    def get_queryset(self):
        project = self.get_project()
        user = self.request.user
        if not project:
            return Document.objects.none()

        role = get_project_role(user, project)
        qs = Document.objects.filter(project=project)

        query_params = (
            getattr(self.request, "query_params", getattr(self.request, "GET", {}))
            if hasattr(self, "request") and self.request
            else {}
        )
        plot_id = query_params.get("plot_id")
        if plot_id:
            qs = qs.filter(plot_id=plot_id)

        # PM, Consultant, Client, Owner can see all documents
        if role in {"owner", "project_manager", "consultant", "client"}:
            return qs

        # Foreman and Storekeeper logic
        # They can see project-level docs if visibility flag is true
        # They can see plot-level docs if visibility flag is true AND they belong to that plot
        if role == "foreman":
            return qs.filter(
                visible_to_foremen=True
            ).filter(
                db_Q(plot__isnull=True) | db_Q(plot__foremen=user)
            )
        elif role == "storekeeper":
            return qs.filter(
                visible_to_storekeepers=True
            ).filter(
                db_Q(plot__isnull=True) | db_Q(plot__foremen=user)
            )
            
        return Document.objects.none()

    def perform_create(self, serializer):
        project = self.get_project()
        serializer.save(project=project, uploaded_by=self.request.user)

class PublicStatsView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        total_projects = ConstructionProject.objects.count()
        # Static average report cycle since date parsing might be complex
        avg_report_cycle_hours = 48
        return Response({
            "total_projects": total_projects,
            "avg_report_cycle_hours": avg_report_cycle_hours
        })


class FeedbackView(APIView):
    """
    POST /api/feedback/
    Allows beta site users to submit improvements, suggestions, bug reports, and complaints.
    Dispatches an email to the address configured via the FEEDBACK_EMAIL environment variable.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip()
        category = request.data.get("category", "General Feedback").strip()
        subject = request.data.get("subject", "").strip()
        message = request.data.get("message", "").strip()
        image = request.FILES.get("image")

        # Pre-fill from authenticated user if not provided
        if request.user and request.user.is_authenticated:
            if not name:
                name = getattr(request.user, "display_name", None) or request.user.get_full_name() or request.user.username
            if not email:
                email = request.user.email

        if not email:
            return Response(
                {"detail": "An email address is required so we can follow up with you."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not message:
            return Response(
                {"detail": "Please provide a description or message."},
                status=status.HTTP_400_BAD_REQUEST
            )

        recipient = getattr(settings, "FEEDBACK_EMAIL", None) or os.environ.get("FEEDBACK_EMAIL", "feedback@constropal.com")
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@constropal.local")

        email_subject = f"[Beta Feedback - {category}] {subject or 'New Submission'}"

        user_info = f"From: {name} <{email}>"
        if request.user and request.user.is_authenticated:
            user_info += f" (Authenticated User ID: {request.user.id}, Username: {request.user.username})"

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        email_body = f"""New Beta Site Feedback Submission:
==================================================
Category: {category}
Subject: {subject or 'N/A'}
{user_info}
Submitted At: {timestamp}
==================================================

Message:
{message}

--------------------------------------------------
This message was sent from the IronWork Beta Site Feedback Form.
"""
        try:
            email_msg = EmailMessage(
                subject=email_subject,
                body=email_body,
                from_email=from_email,
                to=[recipient],
                reply_to=[email] if email else None,
            )
            if image:
                email_msg.attach(image.name, image.read(), image.content_type)
            email_msg.send(fail_silently=False)
            logger.info("Beta feedback email dispatched to %s from %s", recipient, email)
        except Exception as exc:
            logger.exception("Failed to send beta feedback email: %s", exc)
            return Response(
                {"detail": "Could not deliver your message due to an email service error. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            "status": "success",
            "detail": "Thank you for your feedback! Your message has been sent to our team."
        }, status=status.HTTP_200_OK)

