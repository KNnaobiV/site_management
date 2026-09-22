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
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Budget Lane',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Foundation',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_artisan=JobItem.Artisans.MASON,
            start_date=date.today(),
            target_end_date=date.today(),
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

    def test_hierarchical_payment_rollup(self):
        # Create budgets at all levels
        project_budget = ProjectBudget.objects.create(
            project=self.project,
            allocated_amount=Decimal('10000.00'),
        )
        plot_budget = PlotBudget.objects.create(
            plot=self.plot,
            allocated_amount=Decimal('5000.00'),
        )
        work_item_budget = WorkItemBudget.objects.create(
            work_item=self.work_item,
            allocated_amount=Decimal('2500.00'),
        )
        job_item_budget = JobItemBudget.objects.create(
            job_item=self.job_item,
            allocated_amount=Decimal('1000.00'),
        )

        # 1. Add an expense of 300 to the child job item
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('300.00'),
            job_item=self.job_item,
        )

        # Verify it propagates to all parent budgets
        self.assertEqual(job_item_budget.spent_amount, Decimal('300.00'))
        self.assertEqual(work_item_budget.spent_amount, Decimal('300.00'))
        self.assertEqual(plot_budget.spent_amount, Decimal('300.00'))
        self.assertEqual(project_budget.spent_amount, Decimal('300.00'))

        # 2. Add a direct expense of 200 to the parent work item
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('200.00'),
            work_item=self.work_item,
        )

        # Verify job item is unchanged, but parents reflect both (300 + 200 = 500)
        self.assertEqual(job_item_budget.spent_amount, Decimal('300.00'))
        self.assertEqual(work_item_budget.spent_amount, Decimal('500.00'))
        self.assertEqual(plot_budget.spent_amount, Decimal('500.00'))
        self.assertEqual(project_budget.spent_amount, Decimal('500.00'))

        # Also verify core model spent_amount properties
        self.assertEqual(self.job_item.spent_amount, Decimal('300.00'))
        self.assertEqual(self.work_item.spent_amount, Decimal('500.00'))
        self.assertEqual(self.plot.spent_amount, Decimal('500.00'))
        self.assertEqual(self.project.spent_amount, Decimal('500.00'))

        # Soft-deleted expense should not be included in spent_amount calculations
        Expense.objects.create(
            cost_code=self.cost_code,
            amount=Decimal('400.00'),
            job_item=self.job_item,
            is_deleted=True,
            deletion_reason='Mistaken entry',
        )
        self.assertEqual(job_item_budget.spent_amount, Decimal('300.00'))
        self.assertEqual(work_item_budget.spent_amount, Decimal('500.00'))
        self.assertEqual(plot_budget.spent_amount, Decimal('500.00'))
        self.assertEqual(project_budget.spent_amount, Decimal('500.00'))
        self.assertEqual(self.job_item.spent_amount, Decimal('300.00'))
        self.assertEqual(self.work_item.spent_amount, Decimal('500.00'))


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


from rest_framework.test import APITestCase
from rest_framework import status


class JobItemExpenseAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='exp_owner', email='owner@example.com', password='password123')
        self.pm = User.objects.create_user(username='exp_pm', email='pm@example.com', password='password123')
        self.foreman = User.objects.create_user(username='exp_foreman', email='foreman@example.com', password='password123')
        self.strkpr = User.objects.create_user(username='exp_strkpr', email='strkpr@example.com', password='password123')
        self.outsider = User.objects.create_user(username='exp_outsider', email='outsider@example.com', password='password123')

        self.project = ConstructionProject.objects.create(
            created_by=self.owner,
            project_manager=self.pm,
            project_name='API Test Project',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Plot Road',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.plot.foremen.add(self.foreman, self.strkpr)
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Foundation Work',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_name='Steel fixing',
            job_artisan=JobItem.Artisans.IRON_BENDER,
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.url = f'/api/jobitems/{self.job_item.pk}/expenses/'

    def test_owner_can_add_expense(self):
        self.client.force_authenticate(user=self.owner)
        payload = {
            'amount': '5000.00',
            'currency': 'NGN',
            'cost_code_code': 'MATERIALS',
            'description': 'Iron bars purchased',
            'incurred_at': '2026-09-09',
        }
        res = self.client.post(self.url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['amount'], '5000.00')
        self.assertEqual(res.data['cost_code_detail']['code'], 'MATERIALS')
        self.assertEqual(Expense.objects.filter(job_item=self.job_item).count(), 1)

    def test_pm_and_foreman_can_add_expense(self):
        self.client.force_authenticate(user=self.pm)
        res_pm = self.client.post(self.url, {'amount': '1200.00'}, format='json')
        self.assertEqual(res_pm.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_pm.data['cost_code_detail']['code'], 'GENERAL')

        self.client.force_authenticate(user=self.foreman)
        res_fm = self.client.post(self.url, {'amount': '800.00'}, format='json')
        self.assertEqual(res_fm.status_code, status.HTTP_201_CREATED)

    def test_outsider_cannot_add_expense(self):
        self.client.force_authenticate(user=self.outsider)
        res = self.client.post(self.url, {'amount': '1000.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_storekeeper_cannot_add_expense(self):
        self.client.force_authenticate(user=self.strkpr)
        res = self.client.post(self.url, {'amount': '1000.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_cannot_add_expense(self):
        client_user = User.objects.create_user(username='exp_client', email='client@example.com', password='password123')
        self.project.client = client_user
        self.project.save()
        self.client.force_authenticate(user=client_user)
        res = self.client.post(self.url, {'amount': '1000.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


    def test_cannot_add_expense_to_completed_job_item(self):
        self.job_item.job_status = 'Completed'
        self.job_item.save()
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(self.url, {'amount': '1000.00'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_expense(self):
        self.client.force_authenticate(user=self.owner)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='LABOR'),
            amount=Decimal('2000.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res_patch = self.client.patch(detail_url, {'amount': '2500.00'}, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['cost_code_detail']['code'], 'LABOR')
        self.assertEqual(res_patch.data['amount'], '2500.00')

    def test_owner_can_delete_expense_with_reason(self):
        self.client.force_authenticate(user=self.owner)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC1'),
            amount=Decimal('1500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {'reason': 'Mistaken duplicate entry'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        exp.refresh_from_db()
        self.assertTrue(exp.is_deleted)
        self.assertEqual(exp.deletion_reason, 'Mistaken duplicate entry')
        self.assertEqual(exp.deleted_by, self.owner)
        self.assertIsNotNone(exp.deleted_at)
        self.assertEqual(Expense.objects.filter(job_item=self.job_item, is_deleted=False).count(), 0)

    def test_pm_can_delete_expense_with_reason(self):
        self.client.force_authenticate(user=self.pm)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC2'),
            amount=Decimal('750.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {'reason': 'Artisan did not show up'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        exp.refresh_from_db()
        self.assertTrue(exp.is_deleted)
        self.assertEqual(exp.deletion_reason, 'Artisan did not show up')
        self.assertEqual(exp.deleted_by, self.pm)

    def test_delete_expense_with_query_param_reason(self):
        self.client.force_authenticate(user=self.owner)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC3'),
            amount=Decimal('500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/?reason=Reason+in+query+param'
        res = self.client.delete(detail_url)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        exp.refresh_from_db()
        self.assertTrue(exp.is_deleted)
        self.assertEqual(exp.deletion_reason, 'Reason in query param')

    def test_delete_expense_without_reason_fails(self):
        self.client.force_authenticate(user=self.owner)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC4'),
            amount=Decimal('500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', res.data)

    def test_delete_expense_with_whitespace_reason_fails(self):
        self.client.force_authenticate(user=self.owner)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC5'),
            amount=Decimal('500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {'reason': '   '}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', res.data)

    def test_foreman_cannot_delete_expense(self):
        self.client.force_authenticate(user=self.foreman)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC6'),
            amount=Decimal('500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {'reason': 'Trying to delete as foreman'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_storekeeper_cannot_delete_expense(self):
        self.client.force_authenticate(user=self.strkpr)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC7'),
            amount=Decimal('500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {'reason': 'Trying to delete as storekeeper'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_outsider_cannot_delete_expense(self):
        self.client.force_authenticate(user=self.outsider)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC8'),
            amount=Decimal('500.00'),
        )
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res = self.client.delete(detail_url, {'reason': 'Trying to delete as outsider'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_soft_deleted_expense_excluded_from_spent_amount_and_get_list(self):
        self.client.force_authenticate(user=self.owner)
        exp = Expense.objects.create(
            job_item=self.job_item,
            cost_code=CostCode.objects.create(code='MISC9'),
            amount=Decimal('1000.00'),
        )
        # Verify initial spent amounts propagate up
        self.assertEqual(self.job_item.spent_amount, Decimal('1000.00'))
        self.assertEqual(self.work_item.spent_amount, Decimal('1000.00'))
        self.assertEqual(self.plot.spent_amount, Decimal('1000.00'))
        self.assertEqual(self.project.spent_amount, Decimal('1000.00'))

        # GET active expenses returns 1
        res_list = self.client.get(self.url)
        self.assertEqual(len(res_list.data['results'] if 'results' in res_list.data else res_list.data), 1)

        # Delete with valid reason
        detail_url = f'/api/jobitems/{self.job_item.pk}/expenses/{exp.pk}/'
        res_del = self.client.delete(detail_url, {'reason': 'Voiding expense'}, format='json')
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

        # GET active expenses now returns 0
        res_list_after = self.client.get(self.url)
        self.assertEqual(len(res_list_after.data['results'] if 'results' in res_list_after.data else res_list_after.data), 0)

        # Spent amounts all drop back to 0
        self.assertEqual(self.job_item.spent_amount, Decimal('0.00'))
        self.assertEqual(self.work_item.spent_amount, Decimal('0.00'))
        self.assertEqual(self.plot.spent_amount, Decimal('0.00'))
        self.assertEqual(self.project.spent_amount, Decimal('0.00'))


class BudgetPermissionsAPITest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='b_owner', email='owner@example.com', password='password123')
        self.pm = User.objects.create_user(username='b_pm', email='pm@example.com', password='password123')
        self.foreman = User.objects.create_user(username='b_foreman', email='foreman@example.com', password='password123')
        self.client_user = User.objects.create_user(username='b_client', email='client@example.com', password='password123')
        self.consultant = User.objects.create_user(username='b_consultant', email='consultant@example.com', password='password123')
        self.outsider = User.objects.create_user(username='b_outsider', email='outsider@example.com', password='password123')

        self.project = ConstructionProject.objects.create(
            created_by=self.owner,
            project_manager=self.pm,
            client=self.client_user,
            project_name='Budget Test Project',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.project.consultants.add(self.consultant)

        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='456 Plot Boulevard',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.plot.foremen.add(self.foreman)
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Bricklaying',
            start_date=date.today(),
            target_end_date=date.today(),
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_name='Laying Blocks',
            job_artisan=JobItem.Artisans.MASON,
            start_date=date.today(),
            target_end_date=date.today(),
        )

        self.project_budget_url = f'/api/projects/{self.project.pk}/budget/'
        self.plot_budget_url = f'/api/plots/{self.plot.pk}/budget/'
        self.work_item_budget_url = f'/api/workitems/{self.work_item.pk}/budget/'
        self.job_item_budget_url = f'/api/jobitems/{self.job_item.pk}/budget/'

    def test_owner_and_pm_can_view_and_manage_all_budgets(self):
        for user in [self.owner, self.pm]:
            self.client.force_authenticate(user=user)

            # Project Budget
            res = self.client.get(self.project_budget_url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            res_patch = self.client.patch(self.project_budget_url, {'allocated_amount': '50000.00'}, format='json')
            self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
            self.assertEqual(res_patch.data['allocated_amount'], '50000.00')

            # Plot Budget
            res = self.client.get(self.plot_budget_url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            res_patch = self.client.patch(self.plot_budget_url, {'allocated_amount': '25000.00'}, format='json')
            self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

            # Work Item Budget
            res = self.client.get(self.work_item_budget_url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            res_patch = self.client.patch(self.work_item_budget_url, {'allocated_amount': '10000.00'}, format='json')
            self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

            # Job Item Budget
            res = self.client.get(self.job_item_budget_url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            res_patch = self.client.patch(self.job_item_budget_url, {'allocated_amount': '5000.00'}, format='json')
            self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

    def test_foreman_can_view_budgets_and_manage_job_budget(self):
        self.client.force_authenticate(user=self.foreman)

        # Can view project, plot, workitem, jobitem budgets
        for url in [self.project_budget_url, self.plot_budget_url, self.work_item_budget_url, self.job_item_budget_url]:
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Can manage job item budget
        res_patch = self.client.patch(self.job_item_budget_url, {'allocated_amount': '7500.00'}, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['allocated_amount'], '7500.00')

    def test_client_and_consultant_cannot_access_budgets(self):
        for user in [self.client_user, self.consultant, self.outsider]:
            self.client.force_authenticate(user=user)
            for url in [self.project_budget_url, self.plot_budget_url, self.work_item_budget_url, self.job_item_budget_url]:
                res = self.client.get(url)
                self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, f"User {user.username} should get 403 on {url}")
                res_patch = self.client.patch(url, {'allocated_amount': '1.00'}, format='json')
                self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN, f"User {user.username} should get 403 on PATCH {url}")

    def test_client_and_consultant_cannot_view_expenses(self):
        job_exp_url = f'/api/jobitems/{self.job_item.pk}/expenses/'
        plot_exp_url = f'/api/plots/{self.plot.pk}/expenses/'
        proj_exp_url = f'/api/projects/{self.project.pk}/expenses/'

        for user in [self.client_user, self.consultant, self.outsider]:
            self.client.force_authenticate(user=user)
            for url in [job_exp_url, plot_exp_url, proj_exp_url]:
                res = self.client.get(url)
                self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, f"User {user.username} should get 403 on GET {url}")

    def test_serializer_budget_filtering_by_role(self):
        # Create budget on project
        ProjectBudget.objects.create(project=self.project, allocated_amount=Decimal('80000.00'))

        # PM gets full budget object
        self.client.force_authenticate(user=self.pm)
        res_pm = self.client.get(f'/api/projects/{self.project.pk}/')
        self.assertEqual(res_pm.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_pm.data['budget'])
        self.assertEqual(res_pm.data['budget']['allocated_amount'], '80000.00')

        # Owner gets full budget object
        self.client.force_authenticate(user=self.owner)
        res_owner = self.client.get(f'/api/projects/{self.project.pk}/')
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_owner.data['budget'])

        # Foreman gets full budget object
        self.client.force_authenticate(user=self.foreman)
        res_fm = self.client.get(f'/api/projects/{self.project.pk}/')
        self.assertEqual(res_fm.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_fm.data['budget'])

        # Client gets budget: None and spent_amount: '0.00'
        self.client.force_authenticate(user=self.client_user)
        res_client = self.client.get(f'/api/projects/{self.project.pk}/')
        self.assertEqual(res_client.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_client.data['budget'])
        self.assertEqual(res_client.data['spent_amount'], '0.00')

    def test_job_item_cannot_be_completed_before_100_percent_progress(self):
        # job_item currently has 0% progress
        self.client.force_authenticate(user=self.pm)
        res = self.client.patch(
            f'/api/jobitems/{self.job_item.pk}/',
            {"job_status": "Completed"}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("job_status", res.data)

        # Set manual_progress to 100% and then mark completed
        res_ok = self.client.patch(
            f'/api/jobitems/{self.job_item.pk}/',
            {"manual_progress": 100, "job_status": "Completed"}
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.job_item.refresh_from_db()
        self.assertEqual(self.job_item.job_status, "Completed")



