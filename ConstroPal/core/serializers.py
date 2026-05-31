"""
core/api/serializers.py
-----------------------
All serializers for the construction management system.
 
Role-based field visibility
---------------------------
Each model serializer that carries sensitive fields extends
`RoleFilteredSerializer`, which strips fields the requesting user
is not allowed to see before the response is built.
 
The field maps follow this structure:
 
    ROLE_FIELDS: dict[model_name, dict[role_label, set[field_name]]]
 
A user sees the UNION of fields mapped to every role they hold.
If a role is not listed the user sees only the base (public) fields.
"""
from __future__ import annotations
 
from django.contrib.auth import get_user_model
from rest_framework import serializers
 
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
    ProjectRole,
    PlotRole,
    WorkItemImage,
    JobReportImage,
)
from core.roles import get_project_role, get_plot_role
 
User = get_user_model()
 
 
# ===========================================================================
# Base: role-aware serializer
# ===========================================================================
 
class RoleFilteredSerializer(serializers.ModelSerializer):
    """
    Serializer base that removes fields the requesting user cannot see.
 
    Subclasses declare:
        ALWAYS_VISIBLE - fields every authenticated project/plot member sees
        ROLE_EXTRA     - dict mapping role label → extra field names (set/list)
 
    The view is responsible for setting `context["role"]` to the resolved
    role string (e.g. "project_manager") before the serializer is used.
    If no role is in context all fields default to ALWAYS_VISIBLE only.
    """
 
    ALWAYS_VISIBLE: set[str] = set()
    ROLE_EXTRA: dict[str, set[str]] = {}
 
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        role = self._get_role()
        allowed = set(self.ALWAYS_VISIBLE)
        # accumulate extras for this role
        for role_label, extra_fields in self.ROLE_EXTRA.items():
            if role == role_label:
                allowed |= set(extra_fields)
        # owner/PM always get everything
        if role in {"owner", "project_manager"}:
            return  # keep all declared fields
        # drop fields not in allowed set
        declared = set(self.fields.keys())
        for field_name in declared - allowed:
            self.fields.pop(field_name)
 
    def _get_role(self) -> str:
        return self.context.get("role", "none")
 
 
# ===========================================================================
# User (lightweight – never expose sensitive data)
# ===========================================================================
 
class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "display_name", "profile_picture"]
        read_only_fields = ["id", "username", "email"]
 
 
# ===========================================================================
# ConstructionProject
# ===========================================================================
 
class ConstructionProjectSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner      : all fields
    project_manager     : all fields
    client / consultant          : no financials, no internal notes
    plot_member         : basic info + status only
    """
 
    created_by = UserSummarySerializer(read_only=True)
    client = UserSummarySerializer(read_only=True)
    project_manager = UserSummarySerializer(read_only=True)
    consultants = UserSummarySerializer(many=True, read_only=True)
 
    number_of_plots = serializers.IntegerField(required=False, default=1)
    
    role = serializers.SerializerMethodField()
    
    def get_role(self, obj):
        user = self.context.get("request").user
        if not user or not user.is_authenticated:
            return "none"
        from core.roles import get_project_role
        return get_project_role(user, obj)
 
    # Write-only FK inputs
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="client", 
        write_only=True, 
        required=False
    )
    project_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="project_manager", 
        write_only=True,
        required=False
    )
 
    ALWAYS_VISIBLE = {
        "id",
        "project_name",
        "project_description",
        "project_status",
        "proposed_start_date",
        "proposed_end_date",
        "actual_start_date",
        "number_of_plots",
        "role",
    }
 
    ROLE_EXTRA = {
        "project_manager": {
            "created_by",
            "client",
            "client_id",
            "project_manager",
            "project_manager_id",
            "consultants",
        },
        "consultant": {
            "client",
            "project_manager",
            "consultants",
        },
        "plot_member": set(),  # only ALWAYS_VISIBLE
    }
 
    class Meta:
        model = ConstructionProject
        fields = [
            "id",
            "project_name",
            "project_description",
            "project_status",
            "proposed_start_date",
            "proposed_end_date",
            "actual_start_date",
            "created_by",
            "client",
            "client_id",
            "project_manager",
            "project_manager_id",
            "consultants",
            "number_of_plots",
            "is_deleted",
            "role",
        ]
        read_only_fields = ["id", "proposed_start_date", "created_by", "is_deleted"]
        extra_kwargs = {
            "proposed_end_date": {"required": False, "allow_null": True},
            "actual_start_date": {"required": False},
        }
 
    def create(self, validated_data):
        # number_of_plots is saved directly to the model now
        user = self.context["request"].user
        validated_data["created_by"] = user
        if not validated_data.get("project_manager"):
            validated_data["project_manager"] = user
        project = super().create(validated_data)
        return project
 
    def validate(self, data):
        return data
 
 
# ===========================================================================
# ConstructionPlot
# ===========================================================================
 
class ConstructionPlotSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner/client        : all fields
    project_manager     : all fields
    foreman             : own plot fields, no storekeeper details
    storekeeper         : own plot fields, no foreman details
    consultant          : address, dates, project link only
    """
 
    foreman = UserSummarySerializer(read_only=True)
    storekeeper = UserSummarySerializer(read_only=True)
    foreman_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="foreman", 
        write_only=True,
        allow_null=True,
        required=False
    )
    storekeeper_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="storekeeper", 
        write_only=True,
        allow_null=True,
        required=False
    )
    
    project_name = serializers.ReadOnlyField(source="construction_project.project_name")
    role = serializers.SerializerMethodField()
    
    def get_role(self, obj):
        user = self.context.get("request").user
        if not user or not user.is_authenticated:
            return "none"
        from core.roles import get_plot_role
        return get_plot_role(user, obj)
 
    ALWAYS_VISIBLE = {
        "id",
        "construction_project",
        "address",
        "plot_number",
        "plot_opening_date",
        "gps_latitude",
        "gps_longitude",
        "notes",
        "role",
        "project_name",
    }
 
    ROLE_EXTRA = {
        "project_manager": {
            "foreman", "foreman_id",
            "storekeeper", "storekeeper_id",
        },
        "foreman": {
            "foreman", "foreman_id",
        },
        "storekeeper": {
            "storekeeper", "storekeeper_id",
        },
        "consultant": set(),
    }
 
    class Meta:
        model = ConstructionPlot
        fields = [
            "id",
            "construction_project",
            "address",
            "plot_number",
            "plot_opening_date",
            "gps_latitude",
            "gps_longitude",
            "notes",
            "foreman",
            "foreman_id",
            "storekeeper",
            "storekeeper_id",
            "role",
            "project_name",
        ]
        read_only_fields = ["id"]
 
 
# ===========================================================================
# WorkItemImage
# ===========================================================================

class WorkItemImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkItemImage
        fields = ["id", "work_item", "image", "caption", "uploaded_at"]
        read_only_fields = ["id", "work_item", "uploaded_at"]


# ===========================================================================
# WorkItem
# ===========================================================================
 
class WorkItemSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner/client/pm     : all fields including both date pairs
    consultant          : proposed dates + status (no actual dates)
    foreman/storekeeper : all fields (they execute the work)
    """
 
    ALWAYS_VISIBLE = {
        "id",
        "construction_plot",
        "name",
        "description",
        "work_status",
        "is_approved",
        "proposed_start_date",
        "proposed_end_date",
        "checklist",
        "updated_at",
        "images",
        "construction_plot_name",
        "construction_project",
        "foreman",
        "foreman_id",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"start_date", "end_date"},
        "foreman":         {"start_date", "end_date"},
        "storekeeper":     {"start_date", "end_date"},
        "consultant":      set(),
    }
 
    construction_plot_name = serializers.ReadOnlyField(source="construction_plot.address")
    construction_project = serializers.ReadOnlyField(source="construction_plot.construction_project.id")
    images = WorkItemImageSerializer(many=True, read_only=True)
    foreman = UserSummarySerializer(read_only=True)
    foreman_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="foreman", required=False, allow_null=True
    )
 
    class Meta:
        model = WorkItem
        fields = [
            "id",
            "construction_plot",
            "name",
            "description",
            "work_status",
            "proposed_start_date",
            "proposed_end_date",
            "start_date",
            "end_date",
            "is_approved",
            "checklist",
            "updated_at",
            "construction_plot_name",
            "construction_project",
            "images",
            "foreman",
            "foreman_id",
        ]
        read_only_fields = ["id", "updated_at", "construction_plot", "is_approved"]
 
 
# ===========================================================================
# JobReportImage
# ===========================================================================

class JobReportImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobReportImage
        fields = ["id", "report", "image", "caption", "uploaded_at"]
        read_only_fields = ["id", "report", "uploaded_at"]


# ===========================================================================
# JobItem
# ===========================================================================
 
class JobItemSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner/client        : all fields
    project_manager     : all fields
    foreman/storekeeper : all fields (they do the work)
    consultant          : projected dates + status only (no actuals)
    """
 
    ALWAYS_VISIBLE = {
        "id",
        "work_item",
        "job_name",
        "job_description",
        "job_artisan",
        "job_status",
        "is_approved",
        "priority",
        "projected_start_date",
        "projected_end_date",
        "material_requirements",
        "estimated_hours",
        "updated_at",
        "construction_plot",
        "construction_project",
        "work_item_name",
        "construction_plot_name",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"actual_start_date", "actual_end_date"},
        "foreman":         {"actual_start_date", "actual_end_date"},
        "storekeeper":     {"actual_start_date", "actual_end_date"},
        "consultant":      set(),
    }
 
    work_item_name = serializers.ReadOnlyField(source="work_item.name")
    construction_plot = serializers.ReadOnlyField(source="work_item.construction_plot.id")
    construction_plot_name = serializers.ReadOnlyField(source="work_item.construction_plot.address")
    construction_project = serializers.ReadOnlyField(source="work_item.construction_plot.construction_project.id")
 
    class Meta:
        model = JobItem
        fields = [
            "id",
            "work_item",
            "job_name",
            "job_description",
            "job_artisan",
            "job_status",
            "is_approved",
            "priority",
            "projected_start_date",
            "projected_end_date",
            "actual_start_date",
            "actual_end_date",
            "material_requirements",
            "estimated_hours",
            "updated_at",
            "work_item_name",
            "construction_plot",
            "construction_plot_name",
            "construction_project",
        ]
        read_only_fields = ["id", "updated_at", "work_item", "is_approved"]
 
 
# ===========================================================================
# JobReport
# ===========================================================================
 
class JobReportSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner/client        : all fields including internal_comments
    project_manager     : all fields including internal_comments
    consultant          : external_comments, progress, issues, notes only
    foreman/storekeeper : can write; see their own reports fully but
                          not internal_comments from the management side
    """
 
    reported_by = UserSummarySerializer(read_only=True)
    images = JobReportImageSerializer(many=True, read_only=True)
    job_item_name = serializers.ReadOnlyField(source='job_item.job_name')
    work_item_name = serializers.ReadOnlyField(source='job_item.work_item.name')
    construction_plot = serializers.ReadOnlyField(source='job_item.work_item.construction_plot.address')

    ALWAYS_VISIBLE = {
        "id",
        "job_item",
        "job_item_name",
        "work_item_name",
        "construction_plot",
        "reported_by",
        "report_date",
        "report_status",
        "priority",
        "percentage_job_progress",
        "expected_completion_date",
        "issues_encountered",
        "notes",
        "external_comments",
        "days_elapsed",
        "updated_at",
        "images",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"internal_comments", "job_image", "job_video"},
        "foreman":         {"job_image", "job_video"},
        "storekeeper":     {"job_image", "job_video"},
        "consultant":      set(),
    }
 
    class Meta:
        model = JobReport
        fields = [
            "id",
            "job_item",
            "job_item_name",
            "work_item_name",
            "construction_plot",
            "reported_by",
            "report_date",
            "report_status",
            "priority",
            "percentage_job_progress",
            "expected_completion_date",
            "issues_encountered",
            "notes",
            "external_comments",
            "internal_comments",
            "days_elapsed",
            "job_image",
            "job_video",
            "images",
            "updated_at",
        ]
        read_only_fields = ["id", "reported_by", "updated_at", "job_item"]
 
    def create(self, validated_data):
        validated_data["reported_by"] = self.context["request"].user
        return super().create(validated_data)
 
 
class JobReportCommentSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    replies = serializers.SerializerMethodField()
 
    def get_replies(self, obj):
        if obj.replies.exists():
            return JobReportCommentSerializer(obj.replies.all(), many=True).data
        return []
 
    class Meta:
        model = JobReportComment
        fields = ["id", "report", "user", "text", "created_at", "parent", "replies"]
        read_only_fields = ["id", "report", "user", "created_at", "replies"]
 
 
class NotificationSerializer(serializers.ModelSerializer):
    project_name = serializers.ReadOnlyField(source="project.project_name")
    target_url = serializers.ReadOnlyField()

    class Meta:
        model = Notification
        fields = ["id", "user", "project", "project_name", "message", "priority", "is_read", "created_at", "target_url"]
        read_only_fields = ["id", "user", "created_at"]
 
 
# ===========================================================================
# Invitations
# ===========================================================================
 
class ProjectInvitationSerializer(serializers.ModelSerializer):
    invited_by = UserSummarySerializer(read_only=True)
    invitee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="invitee", write_only=True
    )
    invitee = UserSummarySerializer(read_only=True)
    project_name = serializers.ReadOnlyField(source="project.project_name")
    # token is read-only; useful for deep-link emails
    token = serializers.UUIDField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_actionable = serializers.BooleanField(read_only=True)
 
    class Meta:
        model = ProjectInvitation
        fields = [
            "id",
            "project",
            "project_name",
            "invited_by",
            "invitee",
            "invitee_id",
            "role",
            "token",
            "status",
            "message",
            "created_at",
            "expires_at",
            "responded_at",
            "is_expired",
            "is_actionable",
        ]
        read_only_fields = [
            "id", "project", "project_name", "invited_by", "token", "status",
            "created_at", "expires_at", "responded_at",
            "is_expired", "is_actionable",
        ]
 
    def validate_role(self, value):
        if value not in ProjectRole.values:
            raise serializers.ValidationError(
                f"Invalid role. Choose from: {ProjectRole.values}"
            )
        return value
 
 
class PlotInvitationSerializer(serializers.ModelSerializer):
    invited_by = UserSummarySerializer(read_only=True)
    invitee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="invitee", write_only=True
    )
    invitee = UserSummarySerializer(read_only=True)
    plot_address = serializers.ReadOnlyField(source="plot.address")
    project_name = serializers.ReadOnlyField(source="plot.construction_project.project_name")
    token = serializers.UUIDField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_actionable = serializers.BooleanField(read_only=True)
 
    class Meta:
        model = PlotInvitation
        fields = [
            "id",
            "plot",
            "plot_address",
            "project_name",
            "invited_by",
            "invitee",
            "invitee_id",
            "role",
            "token",
            "status",
            "message",
            "created_at",
            "expires_at",
            "responded_at",
            "is_expired",
            "is_actionable",
        ]
        read_only_fields = [
            "id", "plot", "plot_address", "project_name", "invited_by", "token", "status",
            "created_at", "expires_at", "responded_at",
            "is_expired", "is_actionable",
        ]
 
    def validate_role(self, value):
        if value not in PlotRole.values:
            raise serializers.ValidationError(
                f"Invalid role. Choose from: {PlotRole.values}"
            )
        return value
 
 
# Backwards-compat aliases
ConstructionSiteSerializer = ConstructionPlotSerializer
SiteInvitationSerializer = PlotInvitationSerializer


# ===========================================================================
# Image upload serializers (standalone — used by upload actions in views)
# ===========================================================================

class WorkItemImageUploadSerializer(serializers.ModelSerializer):
    """Used for POST /workitems/{pk}/images/ — expects multipart form data."""
    class Meta:
        model = WorkItemImage
        fields = ["id", "image", "caption", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]


class JobReportImageUploadSerializer(serializers.ModelSerializer):
    """Used for POST /reports/{pk}/images/ — expects multipart form data."""
    class Meta:
        model = JobReportImage
        fields = ["id", "image", "caption", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]
