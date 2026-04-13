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
    ConstructionSite,
    WorkItem,
    JobItem,
    JobReport,

    ProjectInvitation,
    SiteInvitation,
    ProjectRole,
    SiteRole,
)
from core.roles import get_project_role, get_site_role
 
User = get_user_model()
 
 
# ===========================================================================
# Base: role-aware serializer
# ===========================================================================
 
class RoleFilteredSerializer(serializers.ModelSerializer):
    """
    Serializer base that removes fields the requesting user cannot see.
 
    Subclasses declare:
        ALWAYS_VISIBLE - fields every authenticated project/site member sees
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
        fields = ["id", "username", "first_name", "last_name", "email"]
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
    site_member         : basic info + status only
    """
 
    created_by = UserSummarySerializer(read_only=True)
    client = UserSummarySerializer(read_only=True)
    project_manager = UserSummarySerializer(read_only=True)
    consultants = UserSummarySerializer(many=True, read_only=True)
 
    # Write-only FK inputs
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="client", write_only=True
    )
    project_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="project_manager", write_only=True
    )
 
    ALWAYS_VISIBLE = {
        "id",
        "project_name",
        "project_description",
        "project_status",
        "project_start_date",
        "project_end_date",
        "actual_start_date",
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
        "site_member": set(),  # only ALWAYS_VISIBLE
    }
 
    class Meta:
        model = ConstructionProject
        fields = [
            "id",
            "project_name",
            "project_description",
            "project_status",
            "project_start_date",
            "project_end_date",
            "actual_start_date",
            "created_by",
            "client",
            "client_id",
            "project_manager",
            "project_manager_id",
            "consultants",
        ]
        read_only_fields = ["id", "project_start_date", "created_by"]
 
    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)
 
 
# ===========================================================================
# ConstructionSite
# ===========================================================================
 
class ConstructionSiteSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner/client        : all fields
    project_manager     : all fields
    foreman             : own site fields, no storekeeper details
    storekeeper         : own site fields, no foreman details
    consultant          : address, dates, project link only
    """
 
    foreman = UserSummarySerializer(read_only=True)
    storekeeper = UserSummarySerializer(read_only=True)
    foreman_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="foreman", write_only=True
    )
    storekeeper_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="storekeeper", write_only=True
    )
 
    ALWAYS_VISIBLE = {
        "id",
        "construction_project",
        "address",
        "site_opening_date",
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
        model = ConstructionSite
        fields = [
            "id",
            "construction_project",
            "address",
            "site_opening_date",
            "foreman",
            "foreman_id",
            "storekeeper",
            "storekeeper_id",
        ]
        read_only_fields = ["id"]
 
 
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
        "construction_site",
        "name",
        "description",
        "work_status",
        "proposed_start_date",
        "proposed_end_date",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"start_date", "end_date"},
        "foreman":         {"start_date", "end_date"},
        "storekeeper":     {"start_date", "end_date"},
        "consultant":      set(),
    }
 
    class Meta:
        model = WorkItem
        fields = [
            "id",
            "construction_site",
            "name",
            "description",
            "work_status",
            "proposed_start_date",
            "proposed_end_date",
            "start_date",
            "end_date",
        ]
        read_only_fields = ["id", "proposed_start_date"]
 
 
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
        "work_status",
        "projected_start_date",
        "projected_end_date",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"actual_start_date", "actual_end_date"},
        "foreman":         {"actual_start_date", "actual_end_date"},
        "storekeeper":     {"actual_start_date", "actual_end_date"},
        "consultant":      set(),
    }
 
    class Meta:
        model = JobItem
        fields = [
            "id",
            "work_item",
            "job_name",
            "job_description",
            "job_artisan",
            "work_status",
            "projected_start_date",
            "projected_end_date",
            "actual_start_date",
            "actual_end_date",
        ]
        read_only_fields = ["id"]
 
 
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
 
    ALWAYS_VISIBLE = {
        "id",
        "job_item",
        "reported_by",
        "report_date",
        "report_status",
        "percentage_job_progress",
        "expected_completion_date",
        "issues_encountered",
        "notes",
        "external_comments",
        "updated_at",
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
            "reported_by",
            "report_date",
            "report_status",
            "percentage_job_progress",
            "expected_completion_date",
            "issues_encountered",
            "notes",
            "external_comments",
            "internal_comments",
            "job_image",
            "job_video",
            "updated_at",
        ]
        read_only_fields = ["id", "reported_by", "updated_at"]
 
    def create(self, validated_data):
        validated_data["reported_by"] = self.context["request"].user
        return super().create(validated_data)
 
 
# ===========================================================================
# Invitations
# ===========================================================================
 
class ProjectInvitationSerializer(serializers.ModelSerializer):
    invited_by = UserSummarySerializer(read_only=True)
    invitee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="invitee", write_only=True
    )
    invitee = UserSummarySerializer(read_only=True)
    # token is read-only; useful for deep-link emails
    token = serializers.UUIDField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_actionable = serializers.BooleanField(read_only=True)
 
    class Meta:
        model = ProjectInvitation
        fields = [
            "id",
            "project",
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
            "id", "invited_by", "token", "status",
            "created_at", "expires_at", "responded_at",
            "is_expired", "is_actionable",
        ]
 
    def validate_role(self, value):
        if value not in ProjectRole.values:
            raise serializers.ValidationError(
                f"Invalid role. Choose from: {ProjectRole.values}"
            )
        return value
 
 
class SiteInvitationSerializer(serializers.ModelSerializer):
    invited_by = UserSummarySerializer(read_only=True)
    invitee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="invitee", write_only=True
    )
    invitee = UserSummarySerializer(read_only=True)
    token = serializers.UUIDField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_actionable = serializers.BooleanField(read_only=True)
 
    class Meta:
        model = SiteInvitation
        fields = [
            "id",
            "site",
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
            "id", "invited_by", "token", "status",
            "created_at", "expires_at", "responded_at",
            "is_expired", "is_actionable",
        ]
 
    def validate_role(self, value):
        if value not in SiteRole.values:
            raise serializers.ValidationError(
                f"Invalid role. Choose from: {SiteRole.values}"
            )
        return value
 