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
    Document,
    StatusChoices,
)
from base.models import Picture, Video
from base.serializers import PictureSerializer, VideoSerializer
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
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "display_name", "profile_picture"]
        read_only_fields = ["id", "username", "email"]

    def get_profile_picture(self, obj):
        if obj.profile_picture and obj.profile_picture.img:
            request = self.context.get('request')
            url = obj.profile_picture.img.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None
 
 
# ===========================================================================
# ConstructionProject
# ===========================================================================

def can_set_manual_progress(user, project) -> bool:
    """Only the project manager or project creator (or superuser) can explicitly set progress."""
    if not user or not getattr(user, "is_authenticated", False) or not project:
        return False
    if getattr(user, "is_superuser", False):
        return True
    return user == getattr(project, "project_manager", None) or user == getattr(project, "created_by", None)


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
    progress = serializers.IntegerField(read_only=True)
    is_progress_manual = serializers.BooleanField(read_only=True)
    manual_progress = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    spent_amount = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()
    
    role = serializers.SerializerMethodField()
    
    def get_role(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return "none"
        from core.roles import get_project_role
        return get_project_role(user, obj)

    def get_spent_amount(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return "0.00"
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return "0.00"
        return str(obj.spent_amount)

    def get_budget(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return None
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return None
        try:
            b = getattr(obj, "project_budget", None)
            if b:
                return {
                    "id": b.id,
                    "allocated_amount": str(b.allocated_amount),
                    "spent_amount": str(b.spent_amount),
                    "remaining_amount": str(b.remaining_amount),
                    "currency": b.currency,
                }
            spent = obj.spent_amount
            return {
                "id": None,
                "allocated_amount": "0.00",
                "spent_amount": str(spent),
                "remaining_amount": str(-spent),
                "currency": "NGN",
            }
        except Exception:
            return None
 
    # Write-only FK inputs
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="client", 
        write_only=True, 
        required=False,
        allow_null=True
    )
    project_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="project_manager", 
        write_only=True, 
        required=False,
        allow_null=True
    )
 
    cover_image = PictureSerializer(read_only=True)
    cover_image_id = serializers.PrimaryKeyRelatedField(
        queryset=Picture.objects.all(), source="cover_image", write_only=True, required=False, allow_null=True
    )
    users = serializers.SerializerMethodField()

    def get_users(self, obj):
        user_dict = {}

        if obj.project_manager:
            user_dict[obj.project_manager.id] = obj.project_manager
        if obj.client:
            user_dict[obj.client.id] = obj.client
        if obj.created_by:
            user_dict[obj.created_by.id] = obj.created_by

        for c in obj.consultants.all():
            user_dict[c.id] = c

        for plot in obj.constructionplot_set.all():
            for f in plot.foremen.all():
                user_dict[f.id] = f

        users_list = list(user_dict.values())[:7]
        return UserSummarySerializer(users_list, many=True, context=self.context).data

    ALWAYS_VISIBLE = {
        "id",
        "project_name",
        "project_description",
        "project_status",
        "start_date",
        "target_end_date",
        "number_of_plots",
        "role",
        "cover_image",
        "cover_image_id",
        "progress",
        "is_progress_manual",
        "manual_progress",
        "duration_days",
        "users",
        "budget",
        "spent_amount",
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
            "start_date",
            "target_end_date",
            "created_by",
            "client",
            "client_id",
            "project_manager",
            "project_manager_id",
            "consultants",
            "number_of_plots",
            "is_deleted",
            "role",
            "cover_image",
            "cover_image_id",
            "progress",
            "is_progress_manual",
            "manual_progress",
            "duration_days",
            "users",
            "budget",
            "spent_amount",
        ]
        read_only_fields = ["id", "start_date", "created_by", "is_deleted", "duration_days", "users", "budget", "spent_amount"]
 
    def create(self, validated_data):
        # number_of_plots is saved directly to the model now
        user = self.context["request"].user
        validated_data["created_by"] = user
        if not validated_data.get("project_manager"):
            validated_data["project_manager"] = user

        request = self.context.get("request")
        cover_image = (request.FILES.get("cover_image") if request else None) or self.initial_data.get("cover_image")
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        if cover_image and isinstance(cover_image, (UploadedFile, File)):
            from base.models import Picture
            pic = Picture.objects.create(img=cover_image, upload_to="projects/covers/")
            validated_data["cover_image"] = pic

        project = super().create(validated_data)
        return project

    def update(self, instance, validated_data):
        request = self.context.get("request")
        cover_image = (request.FILES.get("cover_image") if request else None) or self.initial_data.get("cover_image")
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        from base.models import Picture
        if cover_image and isinstance(cover_image, (UploadedFile, File)):
            pic = Picture.objects.create(img=cover_image, upload_to="projects/covers/")
            instance.cover_image = pic
        elif cover_image is None and "cover_image" in self.initial_data:
            instance.cover_image = None

        return super().update(instance, validated_data)
 
    def validate(self, data):
        if "manual_progress" in data:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            project = self.instance
            if project is not None:
                if project.manual_progress != data["manual_progress"] and not can_set_manual_progress(user, project):
                    raise serializers.ValidationError({"manual_progress": "Only the project manager or creator can explicitly set progress."})
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
 
    foremen = UserSummarySerializer(many=True, read_only=True)
    foremen_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source="foremen", 
        write_only=True,
        many=True,
        required=False
    )
    
    project_name = serializers.ReadOnlyField(source="construction_project.project_name")
    plot_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.SerializerMethodField()
    
    def get_role(self, obj):
        user = self.context.get("request").user
        if not user or not user.is_authenticated:
            return "none"
        from core.roles import get_plot_role
        return get_plot_role(user, obj)

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        plot_name = ret.pop("plot_name", None) or data.get("plot_name")
        if plot_name and not ret.get("plot_number"):
            ret["plot_number"] = plot_name
        return ret

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["plot_name"] = instance.plot_number or instance.address
        return ret
    
    cover_image = PictureSerializer(read_only=True)
    cover_image_id = serializers.PrimaryKeyRelatedField(
        queryset=Picture.objects.all(), source="cover_image", write_only=True, required=False, allow_null=True
    )

    progress = serializers.IntegerField(read_only=True)
    is_progress_manual = serializers.BooleanField(read_only=True)
    manual_progress = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    duration_days = serializers.IntegerField(read_only=True)
    spent_amount = serializers.SerializerMethodField()

    ALWAYS_VISIBLE = {
        "id",
        "construction_project",
        "address",
        "plot_number",
        "plot_name",
        "status",
        "start_date",
        "target_end_date",
        "gps_latitude",
        "gps_longitude",
        "notes",
        "role",
        "project_name",
        "cover_image",
        "cover_image_id",
        "progress",
        "is_progress_manual",
        "manual_progress",
        "duration_days",
        "budget",
        "spent_amount",
    }
 
    ROLE_EXTRA = {
        "project_manager": {
            "foremen", "foremen_ids",
            "budget",
        },
        "foreman": {
            "foremen", "foremen_ids",
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
            "plot_name",
            "status",
            "start_date",
            "target_end_date",
            "gps_latitude",
            "gps_longitude",
            "notes",
            "foremen",
            "foremen_ids",
            "role",
            "project_name",
            "budget",
            "spent_amount",
            "cover_image",
            "cover_image_id",
            "progress",
            "is_progress_manual",
            "manual_progress",
            "duration_days",
        ]
        read_only_fields = ["id", "duration_days", "budget", "spent_amount"]
        extra_kwargs = {
            "construction_project": {"required": False},
        }

    def create(self, validated_data):
        request = self.context.get("request")
        cover_image = (request.FILES.get("cover_image") if request else None) or self.initial_data.get("cover_image")
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        if cover_image and isinstance(cover_image, (UploadedFile, File)):
            from base.models import Picture
            pic = Picture.objects.create(img=cover_image, upload_to="plots/covers/")
            validated_data["cover_image"] = pic

        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get("request")
        cover_image = (request.FILES.get("cover_image") if request else None) or self.initial_data.get("cover_image")
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        from base.models import Picture
        if cover_image and isinstance(cover_image, (UploadedFile, File)):
            pic = Picture.objects.create(img=cover_image, upload_to="plots/covers/")
            instance.cover_image = pic
        elif cover_image is None and "cover_image" in self.initial_data:
            instance.cover_image = None

        return super().update(instance, validated_data)

    def validate(self, data):
        if "manual_progress" in data:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            project = None
            if self.instance:
                if self.instance.manual_progress != data["manual_progress"]:
                    project = self.instance.construction_project
            else:
                if data.get("manual_progress") is not None:
                    project = data.get("construction_project")
            if project and not can_set_manual_progress(user, project):
                raise serializers.ValidationError({"manual_progress": "Only the project manager or creator can explicitly set progress."})
        return data

    budget = serializers.SerializerMethodField()

    def get_spent_amount(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return "0.00"
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return "0.00"
        return str(obj.spent_amount)

    def get_budget(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return None
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return None
        try:
            b = getattr(obj, "plot_budget", None)
            if b:
                return {
                    "id": b.id,
                    "allocated_amount": str(b.allocated_amount),
                    "spent_amount": str(b.spent_amount),
                    "remaining_amount": str(b.remaining_amount),
                    "currency": b.currency,
                }
            spent = obj.spent_amount
            return {
                "id": None,
                "allocated_amount": "0.00",
                "spent_amount": str(spent),
                "remaining_amount": str(-spent),
                "currency": "NGN",
            }
        except Exception:
            return None
 
 
# ===========================================================================
# WorkItemImage
# ===========================================================================

class WorkItemImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    caption = serializers.CharField(source="description", read_only=True)
    uploaded_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Picture
        fields = ["id", "img", "image", "caption", "upload_to", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]

    def get_image(self, obj):
        if obj.img:
            request = self.context.get('request')
            url = obj.img.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


# ===========================================================================
# WorkItem
# ===========================================================================
 
class WorkItemSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    owner/client/pm     : all fields including both date pairs
    foreman/storekeeper : all fields (they execute the work)
    """
 
    progress = serializers.IntegerField(read_only=True)
    is_progress_manual = serializers.BooleanField(read_only=True)
    manual_progress = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    duration_days = serializers.IntegerField(read_only=True)
    spent_amount = serializers.SerializerMethodField()

    ALWAYS_VISIBLE = {
        "id",
        "construction_plot",
        "name",
        "description",
        "work_status",
        "is_approved",
        "start_date",
        "target_end_date",
        "checklist",
        "updated_at",
        "work_item_image",
        "work_item_image_id",
        "images",
        "construction_plot_name",
        "construction_project",
        "foreman",
        "foreman_id",
        "progress",
        "is_progress_manual",
        "manual_progress",
        "duration_days",
        "budget",
        "spent_amount",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"budget"},
        "foreman":         set(),
        "storekeeper":     set(),
        "consultant":      set(),
    }
 
    construction_plot_name = serializers.ReadOnlyField(source="construction_plot.address")
    construction_project = serializers.ReadOnlyField(source="construction_plot.construction_project.id")
    work_item_image = PictureSerializer(read_only=True)
    work_item_image_id = serializers.PrimaryKeyRelatedField(
        queryset=Picture.objects.all(), source="work_item_image", required=False, allow_null=True
    )
    images = serializers.SerializerMethodField()
    foreman = UserSummarySerializer(read_only=True)
    foreman_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="foreman", required=False, allow_null=True
    )

    def get_images(self, obj):
        pics = list(obj.photos.all())
        if obj.work_item_image and obj.work_item_image not in pics:
            pics.insert(0, obj.work_item_image)
        return WorkItemImageSerializer(pics, many=True, context=self.context).data
 
    class Meta:
        model = WorkItem
        fields = [
            "id",
            "construction_plot",
            "name",
            "description",
            "work_status",
            "start_date",
            "target_end_date",
            "is_approved",
            "checklist",
            "updated_at",
            "construction_plot_name",
            "construction_project",
            "work_item_image",
            "work_item_image_id",
            "images",
            "foreman",
            "foreman_id",
            "budget",
            "spent_amount",
            "progress",
            "is_progress_manual",
            "manual_progress",
            "duration_days",
        ]
        read_only_fields = ["id", "updated_at", "construction_plot", "duration_days", "budget", "spent_amount"]

    def validate(self, data):
        if "manual_progress" in data:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            project = None
            if self.instance:
                if self.instance.manual_progress != data["manual_progress"]:
                    plot = self.instance.construction_plot
                    project = getattr(plot, "construction_project", None) if plot else None
            else:
                if data.get("manual_progress") is not None:
                    plot = data.get("construction_plot")
                    if not plot and "view" in self.context and hasattr(self.context["view"], "get_plot"):
                        plot = self.context["view"].get_plot()
                    project = getattr(plot, "construction_project", None) if plot else None
            if project and not can_set_manual_progress(user, project):
                raise serializers.ValidationError({"manual_progress": "Only the project manager or creator can explicitly set progress."})
        return data

    budget = serializers.SerializerMethodField()

    def get_spent_amount(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return "0.00"
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return "0.00"
        return str(obj.spent_amount)

    def get_budget(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return None
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return None
        try:
            b = getattr(obj, "work_item_budget", None)
            if b:
                return {
                    "id": b.id,
                    "allocated_amount": str(b.allocated_amount),
                    "spent_amount": str(b.spent_amount),
                    "remaining_amount": str(b.remaining_amount),
                    "currency": b.currency,
                }
            spent = obj.spent_amount
            return {
                "id": None,
                "allocated_amount": "0.00",
                "spent_amount": str(spent),
                "remaining_amount": str(-spent),
                "currency": "NGN",
            }
        except Exception:
            return None
 
 
# ===========================================================================
# JobReportImage
# ===========================================================================

class JobReportImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    caption = serializers.CharField(source="description", read_only=True)
    uploaded_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Picture
        fields = ["id", "img", "image", "caption", "upload_to", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]

    def get_image(self, obj):
        if obj.img:
            request = self.context.get('request')
            url = obj.img.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


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
 
    progress = serializers.IntegerField(read_only=True)
    is_progress_manual = serializers.BooleanField(read_only=True)
    manual_progress = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    duration_days = serializers.IntegerField(read_only=True)
    previous_report_progress = serializers.IntegerField(read_only=True)
    spent_amount = serializers.SerializerMethodField()

    ALWAYS_VISIBLE = {
        "id",
        "work_item",
        "job_name",
        "job_description",
        "job_artisan",
        "job_status",
        "is_approved",
        "priority",
        "start_date",
        "target_end_date",
        "estimated_hours",
        "updated_at",
        "construction_plot",
        "construction_project",
        "work_item_name",
        "construction_plot_name",
        "progress",
        "is_progress_manual",
        "manual_progress",
        "duration_days",
        "previous_report_progress",
        "budget",
        "spent_amount",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"budget"},
        "foreman":         {"budget"},
        "storekeeper":     set(),
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
            "start_date",
            "target_end_date",
            "estimated_hours",
            "updated_at",
            "work_item_name",
            "construction_plot",
            "construction_plot_name",
            "construction_project",
            "budget",
            "spent_amount",
            "progress",
            "is_progress_manual",
            "manual_progress",
            "duration_days",
            "previous_report_progress",
        ]
        read_only_fields = ["id", "updated_at", "work_item", "duration_days", "previous_report_progress", "spent_amount"]

    def validate(self, data):
        if "manual_progress" in data:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            project = None
            if self.instance:
                if self.instance.manual_progress != data["manual_progress"]:
                    wi = self.instance.work_item
                    plot = getattr(wi, "construction_plot", None) if wi else None
                    project = getattr(plot, "construction_project", None) if plot else None
            else:
                if data.get("manual_progress") is not None:
                    wi = data.get("work_item")
                    plot = getattr(wi, "construction_plot", None) if wi else None
                    if not plot and "view" in self.context and hasattr(self.context["view"], "get_plot"):
                        plot = self.context["view"].get_plot()
                    project = getattr(plot, "construction_project", None) if plot else None
            if project and not can_set_manual_progress(user, project):
                raise serializers.ValidationError({"manual_progress": "Only the project manager or creator can explicitly set progress."})

        # Ensure job item cannot be marked Completed until progress reaches 100%
        target_status = data.get("job_status")
        if target_status in ("Completed", StatusChoices.COMPLETED):
            if not self.instance or self.instance.job_status != StatusChoices.COMPLETED:
                if "manual_progress" in data and data["manual_progress"] is not None:
                    current_progress = data["manual_progress"]
                elif self.instance is not None:
                    current_progress = self.instance.progress
                else:
                    current_progress = 0

                if current_progress < 100:
                    raise serializers.ValidationError({
                        "job_status": "Job item cannot be marked as completed until progress reaches 100%."
                    })

        return data

    budget = serializers.SerializerMethodField()

    def get_spent_amount(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return "0.00"
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return "0.00"
        return str(obj.spent_amount)

    def get_budget(self, obj):
        request = self.context.get("request")
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return None
        from core.roles import can_view_finance
        if not can_view_finance(user, obj):
            return None
        try:
            b = getattr(obj, "job_item_budget", None)
            if b:
                return {
                    "id": b.id,
                    "allocated_amount": str(b.allocated_amount),
                    "spent_amount": str(b.spent_amount),
                    "remaining_amount": str(b.remaining_amount),
                    "currency": b.currency,
                }
            spent = obj.spent_amount
            return {
                "id": None,
                "allocated_amount": "0.00",
                "spent_amount": str(spent),
                "remaining_amount": str(-spent),
                "currency": "NGN",
            }
        except Exception:
            return None
 
 
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
    notes = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "General observation is required.",
            "required": "General observation is required.",
        }
    )
    percentage_job_progress = serializers.IntegerField(required=False, min_value=0, max_value=100)
    previous_report_progress = serializers.SerializerMethodField()
    reported_by = UserSummarySerializer(read_only=True)
    job_image = PictureSerializer(read_only=True)
    job_image_id = serializers.PrimaryKeyRelatedField(
        queryset=Picture.objects.all(), source="job_image", required=False, allow_null=True
    )
    job_video_data = VideoSerializer(source="job_video", read_only=True)
    images = serializers.SerializerMethodField()
    job_item_name = serializers.ReadOnlyField(source='job_item.job_name')
    work_item_name = serializers.ReadOnlyField(source='job_item.work_item.name')
    construction_plot = serializers.ReadOnlyField(source='job_item.work_item.construction_plot.address')

    def get_previous_report_progress(self, obj):
        if obj and obj.job_item:
            prev = (
                obj.job_item.daily_reports
                .exclude(pk=obj.pk)
                .exclude(report_status=JobReport.ReportStatusChoices.rejected)
                .order_by('-report_date', '-id')
                .first()
            )
            return prev.percentage_job_progress if prev else 0
        return 0

    def get_images(self, obj):
        pics = list(obj.photos.all()) if hasattr(obj, 'photos') else []
        if obj.job_image and obj.job_image not in pics:
            pics.insert(0, obj.job_image)
        return JobReportImageSerializer(pics, many=True, context=self.context).data

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
        "previous_report_progress",
        "expected_completion_date",
        "issues_encountered",
        "notes",
        "external_comments",
        "days_elapsed",
        "updated_at",
        "images",
        "video_link",
    }
 
    ROLE_EXTRA = {
        "project_manager": {"internal_comments", "job_image", "job_image_id", "job_video", "job_video_data"},
        "foreman":         {"job_image", "job_image_id", "job_video", "job_video_data"},
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
            "previous_report_progress",
            "expected_completion_date",
            "issues_encountered",
            "notes",
            "external_comments",
            "internal_comments",
            "days_elapsed",
            "job_image",
            "job_image_id",
            "job_video",
            "job_video_data",
            "video_link",
            "images",
            "updated_at",
        ]
        read_only_fields = ["id", "reported_by", "updated_at", "job_item", "previous_report_progress"]

    def validate(self, data):
        if "percentage_job_progress" not in data and not self.instance:
            view = self.context.get("view")
            job_item = None
            if view and hasattr(view, "kwargs") and "jobitem_pk" in view.kwargs:
                job_item = JobItem.objects.filter(pk=view.kwargs["jobitem_pk"]).first()
            elif "job_item" in data:
                job_item = data["job_item"]
            data["percentage_job_progress"] = job_item.previous_report_progress if job_item else 0
        return super().validate(data)
 
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
    image = serializers.ImageField(source="img", required=False)
    caption = serializers.CharField(source="description", required=False, allow_blank=True)

    class Meta:
        model = Picture
        fields = ["id", "img", "image", "caption", "upload_to", "created_at"]
        read_only_fields = ["id", "created_at"]


class JobReportImageUploadSerializer(serializers.ModelSerializer):
    """Used for POST /reports/{pk}/images/ — expects multipart form data."""
    image = serializers.ImageField(source="img", required=False)
    caption = serializers.CharField(source="description", required=False, allow_blank=True)

    class Meta:
        model = Picture
        fields = ["id", "img", "image", "caption", "upload_to", "created_at"]
        read_only_fields = ["id", "created_at"]


# ===========================================================================
# Document
# ===========================================================================

class DocumentSerializer(RoleFilteredSerializer):
    """
    Field visibility by role
    ------------------------
    pm/client/consultant : can see visibility flags
    foreman/storekeeper  : only see document details
    """
    uploaded_by = UserSummarySerializer(read_only=True)
    uploaded_by_display_name = serializers.SerializerMethodField()

    ALWAYS_VISIBLE = {
        "id",
        "project",
        "plot",
        "uploaded_by",
        "uploaded_by_display_name",
        "name",
        "file",
        "created_at",
    }

    ROLE_EXTRA = {
        "project_manager": {"visible_to_storekeepers", "visible_to_foremen"},
        "client": {"visible_to_storekeepers", "visible_to_foremen"},
        "consultant": {"visible_to_storekeepers", "visible_to_foremen"},
        "foreman": set(),
        "storekeeper": set(),
    }

    def get_uploaded_by_display_name(self, obj):
        if obj.uploaded_by:
            return getattr(obj.uploaded_by, "display_name", None) or obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return ""

    class Meta:
        model = Document
        fields = [
            "id",
            "project",
            "plot",
            "uploaded_by",
            "uploaded_by_display_name",
            "name",
            "file",
            "visible_to_storekeepers",
            "visible_to_foremen",
            "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at"]
