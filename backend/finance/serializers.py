"""
finance/serializers.py
----------------------
Serializers for Expense and Budget models.
"""
from decimal import Decimal

from rest_framework import serializers

from .models import (
    CostCode,
    Expense,
    JobItemBudget,
    WorkItemBudget,
    PlotBudget,
    ProjectBudget,
)


class CostCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CostCode
        fields = ["id", "code", "description"]


class ExpenseSerializer(serializers.ModelSerializer):
    """
    Used for creating and listing expenses attached to a job item.
    The `job_item` FK is injected by the view (not accepted from the user).
    """
    cost_code_detail = CostCodeSerializer(source="cost_code", read_only=True)
    # Accept cost_code as a plain code string or id
    cost_code_code = serializers.CharField(write_only=True, required=False, help_text="Cost code string, e.g. 'LABOR'")
    cost_code = serializers.PrimaryKeyRelatedField(
        queryset=CostCode.objects.all(), required=False
    )

    job_item_id = serializers.ReadOnlyField(source="job_item.id")
    job_item_name = serializers.ReadOnlyField(source="job_item.job_name")
    artisan_name = serializers.SerializerMethodField()
    work_item_id = serializers.SerializerMethodField()
    work_item_name = serializers.SerializerMethodField()
    plot_id = serializers.SerializerMethodField()
    plot_name = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id",
            "cost_code",
            "cost_code_code",
            "cost_code_detail",
            "amount",
            "currency",
            "incurred_at",
            "description",
            "job_item",
            "job_item_id",
            "job_item_name",
            "artisan_name",
            "work_item",
            "work_item_id",
            "work_item_name",
            "plot",
            "plot_id",
            "plot_name",
            "project",
            "project_id",
            "project_name",
            "is_deleted",
            "deletion_reason",
            "deleted_by",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_deleted",
            "deletion_reason",
            "deleted_by",
            "deleted_at",
            "created_at",
            "updated_at",
            "cost_code_detail",
            "job_item_id",
            "job_item_name",
            "artisan_name",
            "work_item_id",
            "work_item_name",
            "plot_id",
            "plot_name",
            "project_id",
            "project_name",
        ]

    def get_artisan_name(self, obj):
        if obj.job_item:
            if obj.job_item.job_artisan == "Other" and obj.job_item.custom_artisan:
                return obj.job_item.custom_artisan
            return obj.job_item.job_artisan or "—"
        return "—"

    def get_work_item_id(self, obj):
        if obj.job_item and obj.job_item.work_item:
            return obj.job_item.work_item.id
        if obj.work_item:
            return obj.work_item.id
        return None

    def get_work_item_name(self, obj):
        if obj.job_item and obj.job_item.work_item:
            return obj.job_item.work_item.name
        if obj.work_item:
            return obj.work_item.name
        return None

    def get_plot_id(self, obj):
        if obj.job_item and obj.job_item.work_item and obj.job_item.work_item.construction_plot:
            return obj.job_item.work_item.construction_plot.id
        if obj.work_item and obj.work_item.construction_plot:
            return obj.work_item.construction_plot.id
        if obj.plot:
            return obj.plot.id
        return None

    def get_plot_name(self, obj):
        plot = None
        if obj.job_item and obj.job_item.work_item and obj.job_item.work_item.construction_plot:
            plot = obj.job_item.work_item.construction_plot
        elif obj.work_item and obj.work_item.construction_plot:
            plot = obj.work_item.construction_plot
        elif obj.plot:
            plot = obj.plot
        if plot:
            return plot.plot_number or plot.address
        return None

    def get_project_id(self, obj):
        proj = None
        if obj.job_item and obj.job_item.work_item and obj.job_item.work_item.construction_plot:
            proj = obj.job_item.work_item.construction_plot.construction_project
        elif obj.work_item and obj.work_item.construction_plot:
            proj = obj.work_item.construction_plot.construction_project
        elif obj.plot:
            proj = obj.plot.construction_project
        elif obj.project:
            proj = obj.project
        return proj.id if proj else None

    def get_project_name(self, obj):
        proj = None
        if obj.job_item and obj.job_item.work_item and obj.job_item.work_item.construction_plot:
            proj = obj.job_item.work_item.construction_plot.construction_project
        elif obj.work_item and obj.work_item.construction_plot:
            proj = obj.work_item.construction_plot.construction_project
        elif obj.plot:
            proj = obj.plot.construction_project
        elif obj.project:
            proj = obj.project
        return proj.project_name if proj else None

    def validate(self, attrs):
        # If cost_code_code is provided, look up or auto-create the CostCode
        code_str = attrs.pop("cost_code_code", None)
        if code_str and not attrs.get("cost_code"):
            code_clean = str(code_str).strip().upper()
            cost_code, _ = CostCode.objects.get_or_create(
                code=code_clean,
                defaults={"description": str(code_str).strip().capitalize()},
            )
            attrs["cost_code"] = cost_code
        if not attrs.get("cost_code") and not (self.instance and getattr(self.instance, "cost_code", None)):
            # Default to a generic "GENERAL" cost code on creation if not specified
            cost_code, _ = CostCode.objects.get_or_create(
                code="GENERAL",
                defaults={"description": "General expense"},
            )
            attrs["cost_code"] = cost_code
        return attrs


class JobItemBudgetSerializer(serializers.ModelSerializer):
    spent_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = JobItemBudget
        fields = [
            "id",
            "allocated_amount",
            "currency",
            "spent_amount",
            "remaining_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class WorkItemBudgetSerializer(serializers.ModelSerializer):
    spent_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = WorkItemBudget
        fields = [
            "id",
            "allocated_amount",
            "currency",
            "spent_amount",
            "remaining_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PlotBudgetSerializer(serializers.ModelSerializer):
    spent_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = PlotBudget
        fields = [
            "id",
            "allocated_amount",
            "currency",
            "spent_amount",
            "remaining_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectBudgetSerializer(serializers.ModelSerializer):
    spent_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = ProjectBudget
        fields = [
            "id",
            "allocated_amount",
            "currency",
            "spent_amount",
            "remaining_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

