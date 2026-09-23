from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem
from core.selectors.scope import get_scope, get_project, get_plot

User = get_user_model()


class ScopeSelectorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="password")
        self.project = ConstructionProject.objects.create(
            project_name="Test Project", created_by=self.user
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project, address="123 Test St"
        )
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot, name="Test Work Item", created_by=self.user
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item, job_name="Test Job Item", created_by=self.user
        )

    def test_get_scope_from_job_item(self):
        scope = get_scope(self.job_item)
        self.assertEqual(scope.job_item, self.job_item)
        self.assertEqual(scope.work_item, self.work_item)
        self.assertEqual(scope.plot, self.plot)
        self.assertEqual(scope.project, self.project)

    def test_get_scope_from_work_item(self):
        scope = get_scope(self.work_item)
        self.assertIsNone(scope.job_item)
        self.assertEqual(scope.work_item, self.work_item)
        self.assertEqual(scope.plot, self.plot)
        self.assertEqual(scope.project, self.project)

    def test_get_scope_from_plot(self):
        scope = get_scope(self.plot)
        self.assertIsNone(scope.job_item)
        self.assertIsNone(scope.work_item)
        self.assertEqual(scope.plot, self.plot)
        self.assertEqual(scope.project, self.project)

    def test_get_scope_from_project(self):
        scope = get_scope(self.project)
        self.assertIsNone(scope.job_item)
        self.assertIsNone(scope.work_item)
        self.assertIsNone(scope.plot)
        self.assertEqual(scope.project, self.project)

    def test_get_project_helper(self):
        self.assertEqual(get_project(self.job_item), self.project)

    def test_get_plot_helper(self):
        self.assertEqual(get_plot(self.job_item), self.plot)
