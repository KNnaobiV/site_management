"""
core/api/views.py
-----------------
All ViewSets for the construction management system.

Architecture
------------
- Every ViewSet resolves the project or site from URL kwargs in
  `get_project()` / `get_site()` (cached on the instance).
- `get_serializer_context()` is overridden to inject `role` so
  RoleFilteredSerializer knows which fields to expose.
- `get_queryset()` is always scoped to the authenticated user so
  users cannot enumerate resources they don't belong to.
- Custom actions (@action) handle invitation workflow endpoints.
"""
from __future__ import annotations

from django.core.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import (
    ConstructionProject, 
    ConstructionSite, 
    WorkItem, 
    JobItem, 
    JobReport,
    ProjectInvitation, 
    SiteInvitation,
)
from core.roles import get_project_role, get_site_role
from core.services import (
    invite_to_project,
    invite_to_site,
    accept_project_invitation,
    decline_project_invitation,
    revoke_project_invitation,
    accept_site_invitation,
    decline_site_invitation,
    revoke_site_invitation,
)

from .permissions import (
    IsProjectMember,
    CanManageProject,
    IsProjectOwnerOrCreator,
    IsSiteMember,
    CanManageSite,
    CanSubmitReport,
    CanReviewReport,
    CanSendProjectInvitation,
    CanSendSiteInvitation,
    IsInvitee,
    IsInviterOrProjectOwner,
)
from .serializers import (
    ConstructionProjectSerializer,
    ConstructionSiteSerializer,
    WorkItemSerializer,
    JobItemSerializer,
    JobReportSerializer,
    ProjectInvitationSerializer,
    SiteInvitationSerializer,
)


# ---------------------------------------------------------------------------
# Mixins
# ---------------------------------------------------------------------------

class ProjectScopedMixin:
    """
    Mixin for ViewSets that live under /projects/{project_pk}/.
    Resolves and caches the parent ConstructionProject.
    """
    _project_cache = None

    def get_project(self) -> ConstructionProject:
        if self._project_cache is None:
            self._project_cache = get_object_or_404(
                ConstructionProject, pk=self.kwargs["project_pk"]
            )
        return self._project_cache

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        project = self.get_project()
        ctx["role"] = get_project_role(self.request.user, project)
        ctx["project"] = project
        return ctx


class SiteScopedMixin:
    """
    Mixin for ViewSets that live under /projects/{project_pk}/sites/{site_pk}/.
    Resolves and caches the parent ConstructionSite.
    """
    _site_cache = None

    def get_site(self) -> ConstructionSite:
        if self._site_cache is None:
            self._site_cache = get_object_or_404(
                ConstructionSite,
                pk=self.kwargs["site_pk"],
                construction_project__pk=self.kwargs["project_pk"],
            )
        return self._site_cache

    def get_project(self) -> ConstructionProject:
        return self.get_site().construction_project

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        site = self.get_site()
        ctx["role"] = get_site_role(self.request.user, site)
        ctx["site"] = site
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
        if self.action == "destroy":
            return [IsAuthenticated(), IsProjectOwnerOrCreator()]
        if self.action in ("invite", "list_invitations"):
            return [IsAuthenticated(), CanSendProjectInvitation()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        return ConstructionProject.objects.filter(
            # Any role on the project
            models_Q(created_by=user) |
            models_Q(client=user) |
            models_Q(project_manager=user) |
            models_Q(consultants=user) |
            models_Q(sites__foreman=user) |
            models_Q(sites__storekeeper=user)
        ).distinct()

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


# ---------------------------------------------------------------------------
# ConstructionSite ViewSet
# ---------------------------------------------------------------------------

class ConstructionSiteViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/sites/

    Extra actions
    -------------
    POST /projects/{project_pk}/sites/{pk}/invite/
    GET  /projects/{project_pk}/sites/{pk}/invitations/
    """
    serializer_class = ConstructionSiteSerializer

    def get_site(self):
        return self.get_object()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsProjectMember()]
        if self.action == "create":
            return [IsAuthenticated(), CanManageProject()]
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), CanManageSite()]
        if self.action == "destroy":
            return [IsAuthenticated(), IsProjectOwnerOrCreator()]
        if self.action in ("invite", "list_invitations"):
            return [IsAuthenticated(), CanSendSiteInvitation()]
        return [IsAuthenticated()]

    def get_queryset(self):
        project = self.get_project()
        user = self.request.user
        role = get_project_role(user, project)
        if role in {"owner", "client", "project_manager", "consultant"}:
            return ConstructionSite.objects.filter(construction_project=project)
        # foreman/storekeeper see only their own site
        return ConstructionSite.objects.filter(
            construction_project=project
        ).filter(
            models_Q(foreman=user) | models_Q(storekeeper=user)
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()  # ProjectScopedMixin sets role
        # For site detail actions, re-resolve with site-level role
        if self.kwargs.get("pk"):
            try:
                site = ConstructionSite.objects.get(pk=self.kwargs["pk"])
                ctx["role"] = get_site_role(self.request.user, site)
            except ConstructionSite.DoesNotExist:
                pass
        return ctx

    def perform_create(self, serializer):
        project = self.get_project()
        serializer.save(construction_project=project)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, project_pk=None, pk=None):
        site = self.get_object()
        serializer = SiteInvitationSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        try:
            invitation = invite_to_site(
                actor=request.user,
                site=site,
                invitee=serializer.validated_data["invitee"],
                role=serializer.validated_data["role"],
                message=serializer.validated_data.get("message", ""),
            )
        except (PermissionDenied, ValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            SiteInvitationSerializer(invitation, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="invitations")
    def list_invitations(self, request, project_pk=None, pk=None):
        site = self.get_object()
        qs = SiteInvitation.objects.filter(site=site).select_related(
            "invited_by", "invitee"
        )
        return Response(
            SiteInvitationSerializer(qs, many=True, context=self.get_serializer_context()).data
        )


# ---------------------------------------------------------------------------
# WorkItem ViewSet
# ---------------------------------------------------------------------------

class WorkItemViewSet(SiteScopedMixin, viewsets.ModelViewSet):
    """Nested under /projects/{project_pk}/sites/{site_pk}/workitems/"""
    serializer_class = WorkItemSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsSiteMember()]
        return [IsAuthenticated(), CanManageSite()]

    def get_queryset(self):
        site = self.get_site()
        return WorkItem.objects.filter(construction_site=site)

    def perform_create(self, serializer):
        serializer.save(construction_site=self.get_site())


# ---------------------------------------------------------------------------
# JobItem ViewSet
# ---------------------------------------------------------------------------

class JobItemViewSet(SiteScopedMixin, viewsets.ModelViewSet):
    """
    Nested under /projects/{project_pk}/sites/{site_pk}/workitems/{workitem_pk}/jobitems/
    """
    serializer_class = JobItemSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsSiteMember()]
        return [IsAuthenticated(), CanManageSite()]

    def get_queryset(self):
        return JobItem.objects.filter(
            work_item__construction_site=self.get_site(),
            work_item__pk=self.kwargs["workitem_pk"],
        )

    def perform_create(self, serializer):
        work_item = get_object_or_404(
            WorkItem,
            pk=self.kwargs["workitem_pk"],
            construction_site=self.get_site(),
        )
        serializer.save(work_item=work_item)


# ---------------------------------------------------------------------------
# JobReport ViewSet
# ---------------------------------------------------------------------------

class JobReportViewSet(SiteScopedMixin, viewsets.ModelViewSet):
    """
    Nested under:
    /projects/{project_pk}/sites/{site_pk}/workitems/{workitem_pk}/jobitems/{jobitem_pk}/reports/

    Extra actions
    -------------
    POST .../reports/{pk}/approve/
    POST .../reports/{pk}/reject/
    """
    serializer_class = JobReportSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsSiteMember()]
        if self.action in ("create", "update", "partial_update"):
            return [IsAuthenticated(), CanSubmitReport()]
        if self.action in ("approve", "reject"):
            return [IsAuthenticated(), CanReviewReport()]
        if self.action == "destroy":
            return [IsAuthenticated(), CanManageSite()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return JobReport.objects.filter(
            job_item__work_item__construction_site=self.get_site(),
            job_item__pk=self.kwargs["jobitem_pk"],
        ).select_related("reported_by", "job_item")

    def perform_create(self, serializer):
        job_item = get_object_or_404(
            JobItem,
            pk=self.kwargs["jobitem_pk"],
            work_item__construction_site=self.get_site(),
        )
        serializer.save(job_item=job_item, reported_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, **kwargs):
        report = self.get_object()
        self.check_object_permissions(request, report)
        if report.report_status == JobReport.ReportStatusChoices.approved:
            return Response(
                {"detail": "Report is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report.report_status = JobReport.ReportStatusChoices.approved
        report.save(update_fields=["report_status", "updated_at"])
        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, **kwargs):
        report = self.get_object()
        self.check_object_permissions(request, report)
        internal_comment = request.data.get("internal_comments", "")
        report.report_status = JobReport.ReportStatusChoices.rejected
        if internal_comment:
            report.internal_comments = internal_comment
        report.save(update_fields=["report_status", "internal_comments", "updated_at"])
        return Response(self.get_serializer(report).data)


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


class SiteInvitationViewSet(viewsets.GenericViewSet):
    """
    GET  /invitations/sites/
    POST /invitations/sites/{pk}/accept/
    POST /invitations/sites/{pk}/decline/
    POST /invitations/sites/{pk}/revoke/
    """
    serializer_class = SiteInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return SiteInvitation.objects.filter(
            models_Q(invitee=user) | models_Q(invited_by=user)
        ).select_related("site", "invitee", "invited_by")

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
            accept_site_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            decline_site_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        invitation = get_object_or_404(self.get_queryset(), pk=pk)
        try:
            revoke_site_invitation(actor=request.user, invitation=invitation)
        except (PermissionDenied, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)


# ---------------------------------------------------------------------------
# Import fix: Django Q object
# ---------------------------------------------------------------------------
from django.db.models import Q as models_Q  # noqa: E402