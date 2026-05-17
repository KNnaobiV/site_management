from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import (
    ConstructionProject,
    ConstructionSite,
    Material,
    WorkItem,
    JobItem,
    JobReport,
)


class ConstructionProjectTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            project_start_date='2023-01-01',
            project_end_date='2023-12-31',
            actual_start_date='2023-01-01',
        )

    def test_project_creation(self):
        self.assertEqual(self.project.project_name, 'Test Project')
        self.assertEqual(self.project.client, self.user)


class ConstructionSiteTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            project_start_date='2023-01-01',
            project_end_date='2023-12-31',
            actual_start_date='2023-01-01',
        )
        self.site = ConstructionSite.objects.create(
            construction_project=self.project,
            foreman=self.user,
            storekeeper=self.user,
            address='123 Test St',
            site_opening_date='2023-01-01',
        )

    def test_site_creation(self):
        self.assertEqual(self.site.address, '123 Test St')
        self.assertEqual(self.site.construction_project, self.project)


class MaterialTestCase(TestCase):
    def setUp(self):
        self.material = Material.objects.create(
            material_name='Cement',
            projected_quantity=100,
            actual_quantity=90,
            needed_by='Mason',
            unit_of_measure='Bag',
        )

    def test_material_creation(self):
        self.assertEqual(self.material.material_name, 'Cement')
        self.assertEqual(self.material.projected_quantity, 100)


class WorkItemTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            project_start_date='2023-01-01',
            project_end_date='2023-12-31',
            actual_start_date='2023-01-01',
        )
        self.site = ConstructionSite.objects.create(
            construction_project=self.project,
            foreman=self.user,
            storekeeper=self.user,
            address='123 Test St',
            site_opening_date='2023-01-01',
        )
        self.work_item = WorkItem.objects.create(
            construction_site=self.site,
            name='Foundation',
            description='Build foundation',
            proposed_start_date='2023-01-01',
            proposed_end_date='2023-01-15',
        )

    def test_work_item_creation(self):
        self.assertEqual(self.work_item.name, 'Foundation')
        self.assertEqual(self.work_item.construction_site, self.site)


class JobItemTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            project_start_date='2023-01-01',
            project_end_date='2023-12-31',
            actual_start_date='2023-01-01',
        )
        self.site = ConstructionSite.objects.create(
            construction_project=self.project,
            foreman=self.user,
            storekeeper=self.user,
            address='123 Test St',
            site_opening_date='2023-01-01',
        )
        self.work_item = WorkItem.objects.create(
            construction_site=self.site,
            name='Foundation',
            description='Build foundation',
            proposed_start_date='2023-01-01',
            proposed_end_date='2023-01-15',
        )
        self.material = Material.objects.create(
            material_name='Cement',
            projected_quantity=100,
            actual_quantity=90,
            needed_by='Mason',
            unit_of_measure='Bag',
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_artisan='Mason',
            job_name='Mix Concrete',
            job_description='Mix concrete for foundation',
            projected_start_date='2023-01-01',
            projected_end_date='2023-01-05',
        )
        self.job_item.material_needs.add(self.material)

    def test_job_item_creation(self):
        self.assertEqual(self.job_item.job_name, 'Mix Concrete')
        self.assertEqual(self.job_item.work_item, self.work_item)


class JobReportTestCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='testuser', password='testpass')
        self.project = ConstructionProject.objects.create(
            client=self.user,
            project_manager=self.user,
            project_name='Test Project',
            project_description='Test Description',
            project_start_date='2023-01-01',
            project_end_date='2023-12-31',
            actual_start_date='2023-01-01',
        )
        self.site = ConstructionSite.objects.create(
            construction_project=self.project,
            foreman=self.user,
            storekeeper=self.user,
            address='123 Test St',
            site_opening_date='2023-01-01',
        )
        self.work_item = WorkItem.objects.create(
            construction_site=self.site,
            name='Foundation',
            description='Build foundation',
            proposed_start_date='2023-01-01',
            proposed_end_date='2023-01-15',
        )
        self.material = Material.objects.create(
            material_name='Cement',
            projected_quantity=100,
            actual_quantity=90,
            needed_by='Mason',
            unit_of_measure='Bag',
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item,
            job_artisan='Mason',
            job_name='Mix Concrete',
            job_description='Mix concrete for foundation',
            projected_start_date='2023-01-01',
            projected_end_date='2023-01-05',
        )
        self.job_item.material_needs.add(self.material)
        self.report = JobReport.objects.create(
            job_item=self.job_item,
            reported_by=self.user,
            expected_completion_date='2023-01-05',
            notes='Work in progress',
        )

    def test_report_creation(self):
        self.assertEqual(self.report.job_item, self.job_item)
        self.assertEqual(self.report.reported_by, self.user)
