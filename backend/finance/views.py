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

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import JobItem, WorkItem, ConstructionPlot, ConstructionProject
from core.permissions import CanManageFinance, CanManageJobFinance, CanManageExpenses

from .models import (
    Expense,
    JobItemBudget,
    WorkItemBudget,
    PlotBudget,
    ProjectBudget,
)
from .serializers import (
    ExpenseSerializer,
    JobItemBudgetSerializer,
    WorkItemBudgetSerializer,
    PlotBudgetSerializer,
    ProjectBudgetSerializer,
)


def _soft_delete_expense(request, instance):
    from rest_framework.exceptions import PermissionDenied, ValidationError
    from django.utils import timezone
    from core.roles import get_plot_role, get_project_role

    if instance.job_item and instance.job_item.job_status == 'Completed':
        raise ValidationError({"non_field_errors": ["Cannot delete expenses of a completed job item."]})

    user = request.user
    plot = None
    if instance.job_item and getattr(instance.job_item, "work_item", None):
        plot = instance.job_item.work_item.construction_plot
    elif instance.work_item and getattr(instance.work_item, "construction_plot", None):
        plot = instance.work_item.construction_plot
    elif instance.plot:
        plot = instance.plot

    role = get_plot_role(user, plot) if plot else "none"
    if not plot and instance.project:
        role = get_project_role(user, instance.project)

    is_super = getattr(user, "is_superuser", False)
    if role not in {"owner", "project_manager"} and not is_super:
        raise PermissionDenied("Only the project manager or plot creator can delete an expense.")

    reason = None
    if hasattr(request, "data") and isinstance(request.data, dict):
        reason = request.data.get("reason")
    if not reason:
        reason = request.query_params.get("reason")

    if not reason or not str(reason).strip():
        raise ValidationError({"reason": "A reason for deleting this expense is required."})

    instance.is_deleted = True
    instance.deletion_reason = str(reason).strip()
    instance.deleted_by = user
    instance.deleted_at = timezone.now()
    instance.save(update_fields=["is_deleted", "deletion_reason", "deleted_by", "deleted_at", "updated_at"])


# ---------------------------------------------------------------------------
# Expense ViewSets
# ---------------------------------------------------------------------------

class JobItemExpenseViewSet(viewsets.ModelViewSet):
    """
    CRUD for expenses attached to a specific job item.
    Nested under: /jobitems/{jobitem_pk}/expenses/
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, CanManageExpenses]

    def get_job_item(self):
        jobitem_pk = self.kwargs.get("jobitem_pk")
        if jobitem_pk:
            return get_object_or_404(JobItem, pk=jobitem_pk)
        return None

    def get_plot(self):
        job_item = self.get_job_item()
        if job_item and getattr(job_item, "work_item", None):
            return job_item.work_item.construction_plot
        return None

    def get_queryset(self):
        job_item = self.get_job_item()
        if job_item:
            return Expense.objects.filter(job_item=job_item, is_deleted=False).select_related(
                "cost_code", "job_item", "job_item__work_item", "job_item__work_item__construction_plot"
            ).order_by("-incurred_at", "-created_at")
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return Expense.objects.filter(is_deleted=False).select_related("cost_code")
        return Expense.objects.filter(
            Q(job_item__work_item__construction_plot__construction_project__created_by=user) |
            Q(job_item__work_item__construction_plot__construction_project__project_manager=user) |
            Q(job_item__work_item__construction_plot__foremen=user),
            is_deleted=False
        ).distinct().select_related("cost_code").order_by("-incurred_at", "-created_at")

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError, PermissionDenied
        from core.roles import get_plot_role
        job_item = self.get_job_item()
        if not job_item:
            raise ValidationError({"job_item": "Job item is required."})
        if job_item.job_status == 'Completed':
            raise ValidationError({"non_field_errors": ["Cannot add expenses to a completed job item."]})
        plot = self.get_plot()
        if not getattr(self.request.user, "is_superuser", False):
            role = get_plot_role(self.request.user, plot) if plot else "none"
            if role not in {"owner", "project_manager", "foreman"}:
                raise PermissionDenied("Only the project manager, creator, or foreman can add expenses.")
        serializer.save(job_item=job_item)

    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError, PermissionDenied
        from core.roles import get_plot_role
        expense = self.get_object()
        if expense.job_item and expense.job_item.job_status == 'Completed':
            raise ValidationError({"non_field_errors": ["Cannot update expenses of a completed job item."]})
        plot = self.get_plot()
        if not getattr(self.request.user, "is_superuser", False):
            role = get_plot_role(self.request.user, plot) if plot else "none"
            if role not in {"owner", "project_manager", "foreman"}:
                raise PermissionDenied("Only the project manager, creator, or foreman can update expenses.")
        serializer.save()

    def perform_destroy(self, instance):
        _soft_delete_expense(self.request, instance)


class WorkItemExpenseViewSet(viewsets.ModelViewSet):
    """
    Expenses attached to a work item and its child job items.
    Nested under: /workitems/{workitem_pk}/expenses/
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, CanManageExpenses]

    def get_work_item(self):
        return get_object_or_404(WorkItem, pk=self.kwargs.get("workitem_pk"))

    def get_plot(self):
        wi = self.get_work_item()
        return wi.construction_plot if wi else None

    def get_queryset(self):
        wi = self.get_work_item()
        return Expense.objects.filter(
            Q(work_item=wi) | Q(job_item__work_item=wi),
            is_deleted=False
        ).select_related(
            "cost_code", "job_item", "work_item", "work_item__construction_plot"
        ).order_by("-incurred_at", "-created_at")

    def perform_destroy(self, instance):
        _soft_delete_expense(self.request, instance)


class PlotExpenseViewSet(viewsets.ModelViewSet):
    """
    Expenses attached to a plot, its work items, and child job items.
    Nested under: /plots/{plot_pk}/expenses/
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, CanManageExpenses]

    def get_plot(self):
        return get_object_or_404(ConstructionPlot, pk=self.kwargs.get("plot_pk"))

    def get_queryset(self):
        plot = self.get_plot()
        return Expense.objects.filter(
            Q(plot=plot) | Q(work_item__construction_plot=plot) | Q(job_item__work_item__construction_plot=plot),
            is_deleted=False
        ).select_related(
            "cost_code", "job_item", "work_item", "plot"
        ).order_by("-incurred_at", "-created_at")

    def perform_destroy(self, instance):
        _soft_delete_expense(self.request, instance)


class ProjectExpenseViewSet(viewsets.ModelViewSet):
    """
    Expenses attached to a project, its plots, work items, and child job items.
    Nested under: /projects/{project_pk}/expenses/
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, CanManageExpenses]

    def get_project(self):
        return get_object_or_404(ConstructionProject, pk=self.kwargs.get("project_pk"))

    def get_queryset(self):
        project = self.get_project()
        return Expense.objects.filter(
            Q(project=project) |
            Q(plot__construction_project=project) |
            Q(work_item__construction_plot__construction_project=project) |
            Q(job_item__work_item__construction_plot__construction_project=project),
            is_deleted=False
        ).select_related(
            "cost_code", "job_item", "work_item", "plot", "project"
        ).order_by("-incurred_at", "-created_at")

    def perform_destroy(self, instance):
        _soft_delete_expense(self.request, instance)


class GeneralExpenseViewSet(viewsets.ModelViewSet):
    """
    Flat expenses endpoint:
      GET /expenses/{pk}/
      DELETE /expenses/{pk}/?reason=...
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, CanManageExpenses]
    http_method_names = ['get', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return Expense.objects.filter(is_deleted=False).select_related("cost_code")
        return Expense.objects.filter(
            Q(project__created_by=user) |
            Q(project__project_manager=user) |
            Q(plot__construction_project__created_by=user) |
            Q(plot__construction_project__project_manager=user) |
            Q(plot__foremen=user) |
            Q(work_item__construction_plot__construction_project__created_by=user) |
            Q(work_item__construction_plot__construction_project__project_manager=user) |
            Q(work_item__construction_plot__foremen=user) |
            Q(job_item__work_item__construction_plot__construction_project__created_by=user) |
            Q(job_item__work_item__construction_plot__construction_project__project_manager=user) |
            Q(job_item__work_item__construction_plot__foremen=user),
            is_deleted=False
        ).distinct().select_related("cost_code")

    def perform_destroy(self, instance):
        _soft_delete_expense(self.request, instance)


# ---------------------------------------------------------------------------
# Budget ViewSets (one per level)
# ---------------------------------------------------------------------------

class JobItemBudgetViewSet(viewsets.ViewSet):
    """
    GET  /jobitems/{jobitem_pk}/budget/    → retrieve or create budget
    PATCH /jobitems/{jobitem_pk}/budget/   → update allocated_amount / currency
    """
    permission_classes = [IsAuthenticated, CanManageJobFinance]

    def _get_job_item(self, jobitem_pk):
        return get_object_or_404(JobItem, pk=jobitem_pk)

    def get_plot(self):
        jobitem_pk = self.kwargs.get("jobitem_pk")
        if jobitem_pk:
            job_item = self._get_job_item(jobitem_pk)
            if job_item and getattr(job_item, "work_item", None):
                return job_item.work_item.construction_plot
        return None

    def list(self, request, pk=None, jobitem_pk=None):
        jobitem_pk = jobitem_pk or pk or self.kwargs.get("jobitem_pk")
        job_item = self._get_job_item(jobitem_pk)
        budget, _ = JobItemBudget.objects.get_or_create(
            job_item=job_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        return Response(JobItemBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, jobitem_pk=None):
        from rest_framework.exceptions import ValidationError
        jobitem_pk = jobitem_pk or pk or self.kwargs.get("jobitem_pk")
        job_item = self._get_job_item(jobitem_pk)
        if job_item.job_status == 'Completed':
            raise ValidationError({"non_field_errors": ["Cannot update budget of a completed job item."]})
        budget, _ = JobItemBudget.objects.get_or_create(
            job_item=job_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        serializer = JobItemBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WorkItemBudgetViewSet(viewsets.ViewSet):
    """
    GET  /workitems/{workitem_pk}/budget/
    PATCH /workitems/{workitem_pk}/budget/
    """
    permission_classes = [IsAuthenticated, CanManageFinance]

    def _get_work_item(self, workitem_pk):
        return get_object_or_404(WorkItem, pk=workitem_pk)

    def get_plot(self):
        workitem_pk = self.kwargs.get("workitem_pk")
        if workitem_pk:
            work_item = self._get_work_item(workitem_pk)
            return getattr(work_item, "construction_plot", None)
        return None

    def list(self, request, pk=None, workitem_pk=None):
        workitem_pk = workitem_pk or pk or self.kwargs.get("workitem_pk")
        work_item = self._get_work_item(workitem_pk)
        budget, _ = WorkItemBudget.objects.get_or_create(
            work_item=work_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        return Response(WorkItemBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, workitem_pk=None):
        from django.core.exceptions import ValidationError
        workitem_pk = workitem_pk or pk or self.kwargs.get("workitem_pk")
        work_item = self._get_work_item(workitem_pk)
        if work_item.work_status == 'Completed':
            raise ValidationError("Cannot update budget of a completed work item.")
        budget, _ = WorkItemBudget.objects.get_or_create(
            work_item=work_item,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        serializer = WorkItemBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PlotBudgetViewSet(viewsets.ViewSet):
    """
    GET  /plots/{plot_pk}/budget/
    PATCH /plots/{plot_pk}/budget/
    """
    permission_classes = [IsAuthenticated, CanManageFinance]

    def _get_plot(self, plot_pk):
        return get_object_or_404(ConstructionPlot, pk=plot_pk)

    def get_plot(self):
        plot_pk = self.kwargs.get("plot_pk")
        if plot_pk:
            return self._get_plot(plot_pk)
        return None

    def list(self, request, pk=None, plot_pk=None):
        plot_pk = plot_pk or pk or self.kwargs.get("plot_pk")
        plot = self._get_plot(plot_pk)
        budget, _ = PlotBudget.objects.get_or_create(
            plot=plot,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        return Response(PlotBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, plot_pk=None):
        from django.core.exceptions import ValidationError
        plot_pk = plot_pk or pk or self.kwargs.get("plot_pk")
        plot = self._get_plot(plot_pk)
        if plot.status == 'Completed':
            raise ValidationError("Cannot update budget of a completed plot.")
        budget, _ = PlotBudget.objects.get_or_create(
            plot=plot,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        serializer = PlotBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProjectBudgetViewSet(viewsets.ViewSet):
    """
    GET  /projects/{project_pk}/budget/
    PATCH /projects/{project_pk}/budget/
    """
    permission_classes = [IsAuthenticated, CanManageFinance]

    def _get_project(self, project_pk):
        return get_object_or_404(ConstructionProject, pk=project_pk)

    def get_project(self):
        project_pk = self.kwargs.get("project_pk")
        if project_pk:
            return self._get_project(project_pk)
        return None

    def list(self, request, pk=None, project_pk=None):
        project_pk = project_pk or pk or self.kwargs.get("project_pk")
        project = self._get_project(project_pk)
        budget, _ = ProjectBudget.objects.get_or_create(
            project=project,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        return Response(ProjectBudgetSerializer(budget).data)

    def partial_update(self, request, pk=None, project_pk=None):
        from rest_framework.exceptions import ValidationError
        project_pk = project_pk or pk or self.kwargs.get("project_pk")
        project = self._get_project(project_pk)
        if project.project_status == 'Completed':
            raise ValidationError({"non_field_errors": ["Cannot update budget of a completed project."]})
        budget, _ = ProjectBudget.objects.get_or_create(
            project=project,
            defaults={"allocated_amount": Decimal("0.00"), "currency": "NGN"},
        )
        self.check_object_permissions(request, budget)
        serializer = ProjectBudgetSerializer(budget, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


