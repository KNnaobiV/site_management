from decimal import Decimal
from datetime import date

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Sum
from django.test import TestCase

from core.models import ConstructionPlot, ConstructionProject, JobItem, WorkItem
from .models import (
    CostCode,
    Expense,
    JobItemBudget,
    PlotBudget,
    ProjectBudget,
    WorkItemBudget,
)


User = get_user_model()


class BudgetModelsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='budgetuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            created_by=self.user,
            project_name='Budget Project',
            proposed_start_date=date.today(),
            proposed_end_date=date.today(),
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Budget Lane',
            plot_opening_date=date.today(),
        )
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Foundation',
            proposed_start_date=date.today(),
            proposed_end_date=date.today(),
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_artisan=JobItem.Artisans.MASON,
            projected_start_date=date.today(),
            projected_end_date=date.today(),
        )
        self.cost_code = CostCode.objects.create(
            code='MAT',
            description='Materials',
        )

    def test_budget_spent_is_derived_from_expenses(self):
        budget = ProjectBudget.objects.create(
            project=self.project,
            allocated_amount=Decimal('10000.00'),
        )
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('2500.00'),
            project=self.project,
        )
        self.assertEqual(budget.spent_amount, Decimal('2500.00'))
        self.assertEqual(budget.remaining_amount, Decimal('7500.00'))

    def test_plot_budget_can_aggregate_plot_expenses(self):
        budget = PlotBudget.objects.create(
            plot=self.plot,
            allocated_amount=Decimal('5000.00'),
        )
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('1200.00'),
            plot=self.plot,
        )
        self.assertEqual(budget.spent_amount, Decimal('1200.00'))
        self.assertEqual(budget.remaining_amount, Decimal('3800.00'))

    def test_work_item_budget_can_aggregate_work_item_expenses(self):
        budget = WorkItemBudget.objects.create(
            work_item=self.work_item,
            allocated_amount=Decimal('2500.00'),
        )
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('600.00'),
            work_item=self.work_item,
        )
        self.assertEqual(budget.spent_amount, Decimal('600.00'))
        self.assertEqual(budget.remaining_amount, Decimal('1900.00'))

    def test_job_item_budget_can_aggregate_job_item_expenses(self):
        budget = JobItemBudget.objects.create(
            job_item=self.job_item,
            allocated_amount=Decimal('1200.00'),
        )
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('300.00'),
            job_item=self.job_item,
        )
        self.assertEqual(budget.spent_amount, Decimal('300.00'))
        self.assertEqual(budget.remaining_amount, Decimal('900.00'))

    def test_expense_requires_exactly_one_target(self):
        expense = Expense(
            cost_code=self.cost_code,
            amount=Decimal('100.00'),
        )
        with self.assertRaises(ValidationError):
            expense.full_clean()

    def test_expense_cannot_attach_multiple_targets(self):
        expense = Expense(
            cost_code=self.cost_code,
            amount=Decimal('100.00'),
            project=self.project,
            plot=self.plot,
        )
        with self.assertRaises(ValidationError):
            expense.full_clean()
