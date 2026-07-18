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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "cost_code_detail"]

    def validate(self, attrs):
        # If cost_code_code is provided, look up or auto-create the CostCode
        code_str = attrs.pop("cost_code_code", None)
        if code_str and not attrs.get("cost_code"):
            cost_code, _ = CostCode.objects.get_or_create(
                code=code_str.upper(),
                defaults={"description": code_str.capitalize()},
            )
            attrs["cost_code"] = cost_code
        if not attrs.get("cost_code"):
            # Default to a generic "GENERAL" cost code
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
