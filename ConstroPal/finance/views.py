"""
finance/views.py
----------------
ViewSets for Expense and Budget models.

Endpoints added to core/urls.py:
  GET/POST   /jobitems/{jobitem_pk}/expenses/
  GET/PATCH/PUT/DELETE  /jobitems/{jobitem_pk}/expenses/{pk}/
  GET/PATCH  /jobitems/{jobitem_pk}/budget/
  GET/PATCH  /workitems/{workitem_pk}/budget/   (flat)
  GET/PATCH  /plots/{plot_pk}/budget/           (flat)
"""
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import JobItem, WorkItem, ConstructionPlot

from .models import (
    Expense,
    JobItemBudget,
    WorkItemBudget,
    PlotBudget,
)
from .serializers import (
    ExpenseSerializer,
    JobItemBudgetSerializer,
    WorkItemBudgetSerializer,
    PlotBudgetSerializer,
)


# ---------------------------------------------------------------------------
# Expense ViewSet  (nested under jobitems)
# ---------------------------------------------------------------------------

class JobItemExpenseViewSet(viewsets.ModelViewSet):
    """
    CRUD for expenses attached to a specific job item.

    Nested under: /jobitems/{jobitem_pk}/expenses/
    Also available flat: /expenses/{pk}/ for retrieve/update/delete
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_job_item(self):
        jobitem_pk = self.kwargs.get("jobitem_pk")
        if jobitem_pk:
            return get_object_or_404(JobItem, pk=jobitem_pk)
        return None

    def get_queryset(self):
        job_item = self.get_job_item()
        if job_item:
            return Expense.objects.filter(job_item=job_item).select_related("cost_code")
        # Flat access: all expenses the user owns (via job item hierarchy)
        user = self.request.user
        from django.db.models import Q
        return Expense.objects.filter(
            Q(job_item__work_item__construction_plot__construction_project__created_by=user) |
            Q(job_item__work_item__construction_plot__construction_project__client=user) |
            Q(job_item__work_item__construction_plot__construction_project__project_manager=user) |
            Q(job_item__work_item__construction_plot__foreman=user)
        ).distinct().select_related("cost_code")

    def perform_create(self, serializer):
        job_item = self.get_job_item()
        serializer.save(job_item=job_item)


# ---------------------------------------------------------------------------
# Budget ViewSets (one per level)
# ---------------------------------------------------------------------------

class JobItemBudgetViewSet(viewsets.ViewSet):
    """
    GET  /jobitems/{jobitem_pk}/budget/    → retrieve or create budget
    PATCH /jobitems/{jobitem_pk}/budget/   → update allocated_amount / currency
    """
    permission_classes = [IsAuthenticated]

    def _get_job_item(self, jobitem_pk):
        return get_object_or_404(JobItem, pk=jobitem_pk)

    def list(self, request, jobitem_pk=None):
        job_item = self._get_job_item(jobitem_pk)
        budget, _ = JobItemBudget.objects.get_or_create(
            job_item=job_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        return Response(JobItemBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, jobitem_pk=None):
        job_item = self._get_job_item(jobitem_pk)
        budget, _ = JobItemBudget.objects.get_or_create(
            job_item=job_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        serializer = JobItemBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WorkItemBudgetViewSet(viewsets.ViewSet):
    """
    GET  /workitems/{workitem_pk}/budget/
    PATCH /workitems/{workitem_pk}/budget/
    """
    permission_classes = [IsAuthenticated]

    def _get_work_item(self, workitem_pk):
        return get_object_or_404(WorkItem, pk=workitem_pk)

    def list(self, request, workitem_pk=None):
        work_item = self._get_work_item(workitem_pk)
        budget, _ = WorkItemBudget.objects.get_or_create(
            work_item=work_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        return Response(WorkItemBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, workitem_pk=None):
        work_item = self._get_work_item(workitem_pk)
        budget, _ = WorkItemBudget.objects.get_or_create(
            work_item=work_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        serializer = WorkItemBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PlotBudgetViewSet(viewsets.ViewSet):
    """
    GET  /plots/{plot_pk}/budget/
    PATCH /plots/{plot_pk}/budget/
    """
    permission_classes = [IsAuthenticated]

    def _get_plot(self, plot_pk):
        return get_object_or_404(ConstructionPlot, pk=plot_pk)

    def list(self, request, plot_pk=None):
        plot = self._get_plot(plot_pk)
        budget, _ = PlotBudget.objects.get_or_create(
            plot=plot,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        return Response(PlotBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, plot_pk=None):
        plot = self._get_plot(plot_pk)
        budget, _ = PlotBudget.objects.get_or_create(
            plot=plot,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        serializer = PlotBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
