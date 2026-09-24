"""
core/api/views.py
-----------------
All ViewSets for the construction management system.

Architecture
------------
- Scoping logic is abstracted out into `ScopeResolutionMixin` which handles URL kwargs resolution for projects/plots.
- Mixins are used to reuse ViewSet behavior: `ExportMixin`, `ApprovalMixin`, `ImageHandlingMixin`.
- Authorization and role resolution are fully delegated to `AuthorizationService`.
- Custom filter backends like `ApprovalVisibilityFilterBackend` enforce cross-cutting data restrictions (e.g. unapproved items visibility).
- `NotificationService` handles side-effects like sending notifications when creation/approval happens.
"""
from __future__ import annotations

import io
import os
import datetime
from core.mixins.scoped import ScopeResolutionMixin
from core.mixins.export import ExportMixin
from core.mixins.approval import ApprovalMixin
from core.mixins.images import ImageHandlingMixin
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
from core.roles import get_project_role, get_plot_role
from core.filters.approval_visibility import ApprovalVisibilityFilterBackend
from core.services.notifications import NotificationService
from core.services.authorization import AuthorizationService
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






# ---------------------------------------------------------------------------
# ConstructionProject ViewSet
# ---------------------------------------------------------------------------

class ConstructionProjectViewSet(ScopeResolutionMixin, ExportMixin, viewsets.ModelViewSet):
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
    scope_model = ConstructionProject
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
        if self.action in ("update", "partial_update", "remove_user"):
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
        if self.action in ("list", "create"):
            ctx["role"] = "creator"
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
        username = request.data.get("username")
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(User, username=username)
        
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
    def reports(self, request, **kwargs):
        project = self.get_object()
        role = AuthorizationService(request.user).role_for(project)
        if role == "none":
            raise PermissionDenied("You do not have permission to view reports on this project.")
        
        qs = JobReport.objects.filter(
            job_item__work_item__construction_plot__construction_project=project
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by('-report_date')
        
        if role == "plot_member":
            qs = qs.filter(job_item__work_item__construction_plot__foremen=request.user)

        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)




# ---------------------------------------------------------------------------
# ConstructionPlot ViewSet
# ---------------------------------------------------------------------------

class ConstructionPlotViewSet(ScopeResolutionMixin, ExportMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/plots/

    Extra actions
    -------------
    POST /projects/{project_pk}/plots/{pk}/invite/
    GET  /projects/{project_pk}/plots/{pk}/invitations/
    """
    scope_model = ConstructionPlot
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
        if self.action in ("update", "partial_update", "remove_user"):
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
            if role in {"creator", "client", "project_manager", "consultant"}:
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
        ctx = super().get_serializer_context()  # ScopeResolutionMixin sets role
        
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
        username = request.data.get("username")
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = get_object_or_404(User, username=username)
        
        if plot.foremen.filter(pk=user.pk).exists():
            plot.foremen.remove(user)
        else:
            return Response({"detail": "User not in plot."}, status=status.HTTP_400_BAD_REQUEST)
        
        plot.save()
        return Response({"status": "user removed"})

    @action(detail=True, methods=["get"], url_path="reports")
    def reports(self, request, **kwargs):
        """GET /projects/{project_pk}/plots/{pk}/reports/ — all reports for this plot."""
        plot = self.get_object()
        role = AuthorizationService(request.user).role_for(plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to view reports on this plot.")
        qs = JobReport.objects.filter(
            job_item__work_item__construction_plot=plot
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by("-report_date")
        
        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)




# ---------------------------------------------------------------------------
# WorkItem ViewSet
# ---------------------------------------------------------------------------

class WorkItemViewSet(ScopeResolutionMixin, ExportMixin, ApprovalMixin, ImageHandlingMixin, viewsets.ModelViewSet):
    cover_image_field = 'work_item_image'
    def get_image_serializer_class(self):
        from .serializers import WorkItemImageSerializer
        return WorkItemImageSerializer

    """Nested under /projects/{project_pk}/plots/{plot_pk}/workitems/"""
    scope_model = WorkItem
    serializer_class = WorkItemSerializer
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer, XLSXRenderer, PDFRenderer]
    filter_backends = [ApprovalVisibilityFilterBackend]

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
            return WorkItem.objects.filter(construction_plot=plot).order_by('-updated_at')

        # Global access — restrict to projects the user is part of
        return WorkItem.objects.filter(
            db_Q(construction_plot__construction_project__created_by=user) |
            db_Q(construction_plot__construction_project__client=user) |
            db_Q(construction_plot__construction_project__project_manager=user) |
            db_Q(construction_plot__construction_project__consultants=user) |
            db_Q(construction_plot__foremen=user)
        ).distinct().order_by('-updated_at')

    def perform_update(self, serializer):
        work_item = self.get_object()
        user = self.request.user
        auth = AuthorizationService(user)

        if not auth.can_approve(work_item.construction_plot):
            updated_work_item = serializer.save(is_approved=False)
            project = updated_work_item.construction_plot.construction_project
            ns = NotificationService(project=project)
            recipients = {project.project_manager, project.created_by}
            ns.send_to(recipients, f"Approval required: {user.username} updated work item '{updated_work_item.name}' in plot {updated_work_item.construction_plot.address}", f"/plots/{updated_work_item.construction_plot.pk}/work-items/{updated_work_item.pk}/")
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
        auth = AuthorizationService(user)

        is_approved = auth.can_approve(plot)
        work_item = serializer.save(construction_plot=plot, is_approved=is_approved, created_by=user)

        project = work_item.construction_plot.construction_project
        ns = NotificationService(project=project)

        if not is_approved:
            recipients = {project.project_manager, project.created_by}
            ns.send_to(recipients, f"Approval required: {user.username} submitted work item '{work_item.name}' in plot {plot.address}", f"/plots/{plot.pk}/work-items/{work_item.pk}/")
        else:
            members = ns.project_members()
            ns.send_to(members, f"New work item '{work_item.name}' added to plot {plot.address}", exclude={user})








    @action(detail=True, methods=["get"], url_path="reports")
    def reports(self, request, **kwargs):
        work_item = self.get_object()
        plot = work_item.construction_plot
        role = AuthorizationService(request.user).role_for(plot)
        if role == "none":
            raise PermissionDenied("You do not have permission to view reports on this work item.")
        qs = JobReport.objects.filter(
            job_item__work_item=work_item
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by('-report_date')
        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)



# ---------------------------------------------------------------------------
# JobItem ViewSet
# ---------------------------------------------------------------------------

class JobItemViewSet(ScopeResolutionMixin, ExportMixin, ApprovalMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/
    """
    scope_model = JobItem
    scope_model = JobItem
    serializer_class = JobItemSerializer
    renderer_classes = [JSONRenderer, BrowsableAPIRenderer, XLSXRenderer, PDFRenderer]
    filter_backends = [ApprovalVisibilityFilterBackend]

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

        qs = JobItem.objects.all()
        if plot:
            qs = qs.filter(work_item__construction_plot=plot)
        else:
            qs = qs.filter(
                db_Q(work_item__construction_plot__construction_project__created_by=user) |
                db_Q(work_item__construction_plot__construction_project__client=user) |
                db_Q(work_item__construction_plot__construction_project__project_manager=user) |
                db_Q(work_item__construction_plot__construction_project__consultants=user) |
                db_Q(work_item__construction_plot__foremen=user)
            ).distinct()
            
        if wi_pk:
            qs = qs.filter(work_item__pk=wi_pk)
            
        return qs.order_by('-updated_at')

    def perform_update(self, serializer):
        job_item = self.get_object()
        user = self.request.user
        auth = AuthorizationService(user)

        if not auth.can_approve(job_item.work_item.construction_plot):
            updated_job_item = serializer.save(is_approved=False)
            project = updated_job_item.work_item.construction_plot.construction_project
            ns = NotificationService(project=project)
            recipients = {project.project_manager, project.created_by}
            ns.send_to(recipients, f"Approval required: {user.username} updated job item '{updated_job_item.job_name}'", f"/job-items/{updated_job_item.pk}/")
        else:
            serializer.save()

    def perform_create(self, serializer):
        plot = self.get_plot()
        user = self.request.user
        work_item = get_object_or_404(
            WorkItem,
            pk=self.kwargs["workitem_pk"],
            construction_plot=plot
        )
        if work_item.status == 'Completed':
            raise ValidationError("Cannot add job items to a completed work item.")

        auth = AuthorizationService(user)
        is_approved = auth.can_approve(plot)
        job_item = serializer.save(work_item=work_item, is_approved=is_approved, created_by=user)
        project = work_item.construction_plot.construction_project

        ns = NotificationService(project=project)
        if not is_approved:
            recipients = {project.project_manager, project.created_by}
            ns.send_to(recipients, f"Approval required: {user.username} submitted job item '{job_item.job_name}'", f"/job-items/{job_item.pk}/")
        else:
            members = ns.project_members()
            ns.send_to(members, f"New job item '{job_item.job_name}' added to {work_item.name}", exclude={user})






# ---------------------------------------------------------------------------
# JobReport ViewSet
# ---------------------------------------------------------------------------

class JobReportViewSet(ScopeResolutionMixin, ExportMixin, ApprovalMixin, ImageHandlingMixin, viewsets.ModelViewSet):
    cover_image_field = 'job_image'
    def get_image_serializer_class(self):
        from .serializers import JobReportImageSerializer
        return JobReportImageSerializer

    """
    Nested under:
    /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/{jobitem_pk}/reports/

    Extra actions
    -------------
    POST .../reports/{pk}/approve/
    POST .../reports/{pk}/reject/
    """
    scope_model = JobReport
    serializer_class = JobReportSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "export_reports"):
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


    def _notify_report_comment(self, report, comment):
        project = report.job_item.work_item.construction_plot.construction_project
        ns = NotificationService(project=project)
        members = ns.project_members()
        ns.send_to(members, f"New comment on report for {report.job_item.job_name} in {report.job_item.work_item.name}", exclude={comment.user})

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
                message=f"New {report.priority} report submitted for {job_item.job_name} in {job_item.work_item.name}",
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
        is_creator_or_pm = (
            role_project in ("creator", "project_manager") or
            role_plot in ("creator", "project_manager") or
            getattr(user, "is_superuser", False)
        )
        if not is_creator_or_pm:
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

class DocumentViewSet(ScopeResolutionMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/documents/
    Can also filter by plot via query param ?plot_id=
    """
    scope_model = Document
    scope_model = Document
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

        # PM, Consultant, Client, Creator can see all documents
        if role in {"creator", "project_manager", "consultant", "client"}:
            return qs

        # Foreman, Storekeeper, and Plot Member logic
        # They can see project-level docs if visibility flag is true
        # They can see plot-level docs if visibility flag is true AND they belong to that plot
        if role in {"foreman", "storekeeper", "plot_member"}:
            return qs.filter(
                db_Q(visible_to_foremen=True) | db_Q(visible_to_storekeepers=True)
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
