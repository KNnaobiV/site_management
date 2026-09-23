from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import (
    ConstructionProject,
    ConstructionPlot,
    WorkItem,
    JobItem,
    JobReport,
)


class ConstructionProjectTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            created_by=self.user, client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )

    def test_project_creation(self):
        self.assertEqual(self.project.project_name, 'Test Project')
        self.assertEqual(self.project.client, self.user)


class ConstructionPlotTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            created_by=self.user, client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Test St',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot.foremen.add(self.user)

    def test_plot_creation(self):
        self.assertEqual(self.plot.address, '123 Test St')
        self.assertEqual(self.plot.construction_project, self.project)


class WorkItemTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            created_by=self.user, client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Test St',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot.foremen.add(self.user)
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Foundation',
            description='Build foundation',
            start_date='2023-01-01',
            target_end_date='2023-01-15',
        )

    def test_work_item_creation(self):
        self.assertEqual(self.work_item.name, 'Foundation')
        self.assertEqual(self.work_item.construction_plot, self.plot)


class JobItemTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            created_by=self.user, client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Test St',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot.foremen.add(self.user)
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Foundation',
            description='Build foundation',
            start_date='2023-01-01',
            target_end_date='2023-01-15',
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_artisan='Mason',
            job_name='Mix Concrete',
            job_description='Mix concrete for foundation',
            start_date='2023-01-01',
            target_end_date='2023-01-05',
        )

    def test_job_item_creation(self):
        self.assertEqual(self.job_item.job_name, 'Mix Concrete')
        self.assertEqual(self.job_item.work_item, self.work_item)


class JobReportTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            created_by=self.user, client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project,
            address='123 Test St',
            start_date='2023-01-01',
            target_end_date='2023-12-31',
        )
        self.plot.foremen.add(self.user)
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot,
            name='Foundation',
            description='Build foundation',
            start_date='2023-01-01',
            target_end_date='2023-01-15',
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_artisan='Mason',
            job_name='Mix Concrete',
            job_description='Mix concrete for foundation',
            start_date='2023-01-01',
            target_end_date='2023-01-05',
        )
        self.report = JobReport.objects.create(
            job_item=self.job_item,
            reported_by=self.user,
            expected_completion_date='2023-01-05',
            notes='Work in progress',
            percentage_job_progress=50,
        )

    def test_report_creation(self):
        self.assertEqual(self.report.job_item, self.job_item)
        self.assertEqual(self.report.reported_by, self.user)


