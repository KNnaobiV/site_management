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

from django.core.exceptions import PermissionDenied, ValidationError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image as PDFImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
    WorkItemImage,
    JobReportImage,
)
from core.roles import get_project_role, get_plot_role, SEES_UNAPPROVED_ROLES
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
)

from django.db.models import Q as models_Q


# ---------------------------------------------------------------------------
# Mixins
# ---------------------------------------------------------------------------

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
            plot_pk = self.kwargs.get("plot_pk")
            project_pk = self.kwargs.get("project_pk")
            if not plot_pk:
                return None
            
            filter_kwargs = {"pk": plot_pk}
            if project_pk:
                filter_kwargs["construction_project__pk"] = project_pk
                
            self._plot_cache = get_object_or_404(ConstructionPlot, **filter_kwargs)
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
        qs = ConstructionProject.objects.filter(
            # Any role on the project
            models_Q(created_by=user) |
            models_Q(client=user) |
            models_Q(project_manager=user) |
            models_Q(consultants=user) |
            models_Q(constructionplot__foreman=user) |
            models_Q(constructionplot__storekeeper=user)
        ).distinct()
        
        if not user.is_superuser:
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
        qs = JobReport.objects.filter(
            job_item__work_item__construction_plot__construction_project=project
        ).select_related("reported_by", "job_item", "job_item__work_item").order_by('-report_date')
        serializer = JobReportSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)


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
                models_Q(foreman=user) | models_Q(storekeeper=user)
            )
        else:
            # Top-level list: all plots user belongs to across all projects
            return ConstructionPlot.objects.filter(
                models_Q(construction_project__created_by=user) |
                models_Q(construction_project__client=user) |
                models_Q(construction_project__project_manager=user) |
                models_Q(construction_project__consultants=user) |
                models_Q(foreman=user) |
                models_Q(storekeeper=user)
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
        
        if plot.foreman == user:
            plot.foreman = None
        elif plot.storekeeper == user:
            plot.storekeeper = None
        else:
            return Response({"detail": "User not in plot."}, status=status.HTTP_400_BAD_REQUEST)
        
        plot.save()
        return Response({"status": "user removed"})

    @action(detail=True, methods=["get"], url_path="reports")
    def reports(self, request, project_pk=None, pk=None):
        """GET /projects/{project_pk}/plots/{pk}/reports/ — all reports for this plot."""
        plot = self.get_object()
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
        ).prefetch_related("images").order_by('report_date')

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
            reports_by_job = {}
            for report in queryset:
                key = report.job_item.id
                if key not in reports_by_job:
                    reports_by_job[key] = {
                        "job_name": report.job_item.job_name,
                        "work_item_name": report.job_item.work_item.name,
                        "plot_name": plot.address,
                        "reports": [],
                    }
                reports_by_job[key]["reports"].append(report)

            for group in reports_by_job.values():
                story.append(Paragraph(
                    f"{group['job_name']} for {group['work_item_name']} at {group['plot_name']}",
                    styles["Heading2"]
                ))
                story.append(Spacer(1, 8))

                table_data = [[
                    "Date",
                    "Progress %",
                    "Notes",
                    "Blockers",
                    "Days elapsed",
                    "Projected end",
                    "Priority",
                ]]
                for report in group["reports"]:
                    table_data.append([
                        report.report_date.isoformat() if hasattr(report.report_date, "isoformat") else str(report.report_date),
                        f"{report.percentage_job_progress}%",
                        report.notes or "—",
                        report.issues_encountered or "—",
                        report.days_elapsed if report.days_elapsed is not None else "—",
                        report.expected_completion_date or "—",
                        report.priority or "—",
                    ])

                table = Table(table_data, colWidths=[70, 60, 140, 110, 55, 80, 50])
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.whitesmoke),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]))
                story.append(table)
                story.append(Spacer(1, 12))

                for report in group["reports"]:
                    if report.images.exists():
                        story.append(Paragraph(f"Photos for {report.report_date}:", styles["Heading4"]))
                        for image in report.images.all():
                            image_path = getattr(image.image, 'path', None)
                            if image_path and os.path.exists(image_path):
                                try:
                                    story.append(PDFImage(image_path, width=5 * inch, height=3 * inch))
                                    if image.caption:
                                        story.append(Paragraph(image.caption, styles["Italic"]))
                                    story.append(Spacer(1, 8))
                                except Exception:
                                    continue
                story.append(Spacer(1, 20))

        doc.build(story)
        buffer.seek(0)
        filename = f"plot_{plot.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)


# ---------------------------------------------------------------------------
# WorkItem ViewSet
# ---------------------------------------------------------------------------

class WorkItemViewSet(PlotScopedMixin, viewsets.ModelViewSet):
    """Nested under /projects/{project_pk}/plots/{plot_pk}/workitems/"""
    serializer_class = WorkItemSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsPlotMember()]
        if self.action == "create":
            return [IsAuthenticated(), CanCreateWorkItem()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), CanUpdateWorkItem()]
        if self.action == "destroy":
            return [IsAuthenticated(), CanDeleteWorkItem()]
        if self.action in ("approve", "reject"):
            return [IsAuthenticated(), CanApproveWorkItem()]
        return [IsAuthenticated(), CanManagePlot()]

    def get_queryset(self):
        plot = self.get_plot()
        user = self.request.user

        if plot:
            role = get_plot_role(user, plot)
            qs = WorkItem.objects.filter(construction_plot=plot)
            # Client / consultant / storekeeper only see PM-approved items
            if role not in SEES_UNAPPROVED_ROLES:
                qs = qs.filter(is_approved=True)
            return qs.order_by('-updated_at')

        # Global access — restrict unapproved items for limited roles
        base_qs = WorkItem.objects.filter(
            models_Q(construction_plot__construction_project__created_by=user) |
            models_Q(construction_plot__construction_project__client=user) |
            models_Q(construction_plot__construction_project__project_manager=user) |
            models_Q(construction_plot__construction_project__consultants=user) |
            models_Q(construction_plot__foreman=user) |
            models_Q(construction_plot__storekeeper=user)
        ).distinct()

        # Filter unapproved items unless user is PM/owner/foreman on that plot
        can_see_unapproved = (
            models_Q(construction_plot__construction_project__created_by=user) |
            models_Q(construction_plot__construction_project__project_manager=user) |
            models_Q(construction_plot__foreman=user)
        )
        return base_qs.filter(
            models_Q(is_approved=True) | can_see_unapproved
        ).order_by('-updated_at')

    def perform_create(self, serializer):
        plot = self.get_plot()
        if plot.status == 'Completed':
            raise ValidationError("Cannot add work items to a completed plot.")

        user = self.request.user
        role = get_plot_role(user, plot)

        # Foreman-created items start unapproved; PM/owner items are auto-approved
        is_approved = role in {"owner", "project_manager"}
        work_item = serializer.save(construction_plot=plot, is_approved=is_approved)

        project = work_item.construction_plot.construction_project

        if not is_approved:
            # Notify PM that a foreman submitted a work item for approval
            recipients = [project.project_manager, project.created_by]
            notifications = [
                Notification(
                    user=pm,
                    project=project,
                    message=(
                        f"Approval required: Foreman submitted work item "
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
                if p.foreman:
                    members.add(p.foreman)
                if p.storekeeper:
                    members.add(p.storekeeper)
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

        # Notify the foreman whose item was approved
        plot = work_item.construction_plot
        project = plot.construction_project
        if plot.foreman:
            Notification.objects.create(
                user=plot.foreman,
                project=project,
                message=f"Your work item '{work_item.name}' has been approved by the PM.",
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

        # Notify the foreman whose item was rejected
        plot = work_item.construction_plot
        project = plot.construction_project
        reason = request.data.get("reason", "")
        message = f"Your work item '{work_item.name}' was rejected by the PM."
        if reason:
            message += f" Reason: {reason}"
        if plot.foreman:
            Notification.objects.create(
                user=plot.foreman,
                project=project,
                message=message,
                priority=Notification.Priority.HIGH,
                target_url=f"/plots/{plot.pk}/work-items/{work_item.pk}/"
            )
        return Response({"status": "rejected"})

    @action(detail=True, methods=["post", "get"], url_path="images")
    def images(self, request, **kwargs):
        """GET/POST images for a work item. POST expects multipart/form-data."""
        work_item = self.get_object()
        if request.method == "GET":
            from .serializers import WorkItemImageSerializer
            qs = WorkItemImage.objects.filter(work_item=work_item)
            return Response(WorkItemImageSerializer(qs, many=True, context=self.get_serializer_context()).data)
        # POST
        serializer = WorkItemImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(work_item=work_item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# JobItem ViewSet
# ---------------------------------------------------------------------------

class JobItemViewSet(PlotScopedMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/plots/{plot_pk}/workitems/{workitem_pk}/jobitems/
    """
    serializer_class = JobItemSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
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
        plot = self.get_plot()
        user = self.request.user
        wi_pk = self.kwargs.get("workitem_pk")

        if plot and wi_pk:
            role = get_plot_role(user, plot)
            qs = JobItem.objects.filter(
                work_item__construction_plot=plot,
                work_item__pk=wi_pk,
            )
            # Client / consultant / storekeeper only see job items that are approved
            if role not in SEES_UNAPPROVED_ROLES:
                qs = qs.filter(is_approved=True)
            return qs.order_by('-updated_at')

        # Global access — restrict unapproved for limited roles
        base_qs = JobItem.objects.filter(
            models_Q(work_item__construction_plot__construction_project__created_by=user) |
            models_Q(work_item__construction_plot__construction_project__client=user) |
            models_Q(work_item__construction_plot__construction_project__project_manager=user) |
            models_Q(work_item__construction_plot__construction_project__consultants=user) |
            models_Q(work_item__construction_plot__foreman=user) |
            models_Q(work_item__construction_plot__storekeeper=user)
        ).distinct()

        can_see_unapproved = (
            models_Q(work_item__construction_plot__construction_project__created_by=user) |
            models_Q(work_item__construction_plot__construction_project__project_manager=user) |
            models_Q(work_item__construction_plot__foreman=user)
        )
        return base_qs.filter(
            models_Q(is_approved=True) | can_see_unapproved
        ).order_by('-updated_at')

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

        role = get_plot_role(user, plot)
        is_approved = role in {"owner", "project_manager"}
        job_item = serializer.save(work_item=work_item, is_approved=is_approved)

        project = work_item.construction_plot.construction_project
        role = get_plot_role(user, plot)

        if role == "foreman":
            # Notify PM that foreman added a job item
            recipients = [project.project_manager, project.created_by]
            notifications = [
                Notification(
                    user=pm,
                    project=project,
                    message=(
                        f"Foreman added job item '{job_item.job_name}' "
                        f"({job_item.job_artisan}) to work item '{work_item.name}'"
                    ),
                    priority=Notification.Priority.NORMAL,
                    target_url=f"/job-items/{job_item.pk}/"
                )
                for pm in recipients if pm
            ]
            Notification.objects.bulk_create(notifications)
        else:
            # Notify plot foreman and stakeholders
            members = set([project.created_by, project.client, project.project_manager])
            if plot.foreman:
                members.add(plot.foreman)
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

        # Notify the foreman whose item was approved
        plot = job_item.work_item.construction_plot
        project = plot.construction_project
        if plot.foreman:
            Notification.objects.create(
                user=plot.foreman,
                project=project,
                message=f"Your job item '{job_item.job_name}' has been approved by the PM.",
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

        # Notify the foreman whose item was rejected
        plot = job_item.work_item.construction_plot
        project = plot.construction_project
        reason = request.data.get("reason", "")
        message = f"Your job item '{job_item.job_name}' was rejected by the PM."
        if reason:
            message += f" Reason: {reason}"
        if plot.foreman:
            Notification.objects.create(
                user=plot.foreman,
                project=project,
                message=message,
                priority=Notification.Priority.HIGH,
                target_url=f"/job-items/{job_item.pk}/"
            )
        return Response({"status": "rejected"})


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
        ).prefetch_related("images").order_by('report_date')

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

                report_table_data = [
                    ["Field", "Value"],
                    ["Notes", report.notes or "—"],
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
                story.append(Spacer(1, 12))

                if report.images.exists():
                    story.append(Paragraph("Photos:", styles["Heading4"]))
                    for image in report.images.all():
                        image_path = getattr(image.image, 'path', None)
                        if image_path and os.path.exists(image_path):
                            try:
                                story.append(PDFImage(image_path, width=5 * inch, height=3 * inch))
                                if image.caption:
                                    story.append(Paragraph(image.caption, styles["Italic"]))
                                story.append(Spacer(1, 8))
                            except Exception:
                                continue
                story.append(Spacer(1, 20))

        doc.build(story)
        buffer.seek(0)
        filename = f"plot_{plot.id}_reports_{start_date.isoformat()}_{end_date.isoformat()}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)

    def _notify_report_comment(self, report, comment):
        project = report.job_item.work_item.construction_plot.construction_project
        plot = report.job_item.work_item.construction_plot
        members = set([project.created_by, project.client, project.project_manager])
        members.update(project.consultants.all())
        if plot.foreman:
            members.add(plot.foreman)
        if plot.storekeeper:
            members.add(plot.storekeeper)
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
        report = serializer.save(job_item=job_item, reported_by=self.request.user)
        
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
            ) for m in members if m
        ]
        Notification.objects.bulk_create(notifications)

        if project.project_manager and project.project_manager != self.request.user:
            Notification.objects.create(
                user=project.project_manager,
                project=project,
                message=(
                    f"Approval required: {job_item.job_name} report submitted "
                    f"for {job_item.work_item.name}"
                ),
                priority=Notification.Priority.NORMAL,
                target_url=(f"/job-items/{job_item.pk}?report={report.pk}")
            )

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

    @action(detail=True, methods=["post", "get"], url_path="images")
    def images(self, request, **kwargs):
        """GET/POST images for a daily report. POST expects multipart/form-data."""
        report = self.get_object()
        if request.method == "GET":
            from .serializers import JobReportImageSerializer
            qs = JobReportImage.objects.filter(report=report)
            return Response(JobReportImageSerializer(qs, many=True, context=self.get_serializer_context()).data)
        # POST
        serializer = JobReportImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(report=report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
            models_Q(invitee=user) | models_Q(invited_by=user)
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
            models_Q(invitee=user) | models_Q(invited_by=user)
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