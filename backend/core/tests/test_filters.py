from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem
from core.filters.approval_visibility import ApprovalVisibilityFilterBackend

User = get_user_model()


class MockView:
    def __init__(self, kwargs=None, scope_obj=None):
        self.kwargs = kwargs or {}
        self.scope_obj = scope_obj

    def get_scope_object(self):
        return self.scope_obj


class ApprovalVisibilityFilterTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="creator", email="owner@example.com", password="password")
        self.foreman = User.objects.create_user(username="foreman", email="foreman@example.com", password="password")
        self.other = User.objects.create_user(username="other", email="other@example.com", password="password")

        self.project = ConstructionProject.objects.create(
            project_name="Test Project", created_by=self.owner
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project, address="123 Test St"
        )
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot, name="Test Work Item", created_by=self.owner
        )
        
        # Unapproved, created by owner
        self.item1 = JobItem.objects.create(
            work_item=self.work_item, job_name="Item 1", created_by=self.owner, is_approved=False
        )
        # Approved, created by owner
        self.item2 = JobItem.objects.create(
            work_item=self.work_item, job_name="Item 2", created_by=self.owner, is_approved=True
        )
        # Unapproved, created by foreman
        self.item3 = JobItem.objects.create(
            work_item=self.work_item, job_name="Item 3", created_by=self.foreman, is_approved=False
        )
        
        self.factory = RequestFactory()
        self.filter_backend = ApprovalVisibilityFilterBackend()

    def test_visible_to_creator(self):
        qs = JobItem.objects.all()
        request = self.factory.get('/')
        request.user = self.owner
        view = MockView(kwargs={'project_pk': self.project.pk}, scope_obj=self.project)
        
        # Creator sees everything in their project
        filtered = self.filter_backend.filter_queryset(request, qs, view)
        self.assertEqual(filtered.count(), 3)

    def test_visible_to_foreman(self):
        qs = JobItem.objects.all()
        request = self.factory.get('/')
        request.user = self.foreman
        view = MockView(kwargs={'plot_pk': self.plot.pk}, scope_obj=self.plot)
        
        # Foreman sees approved (item2) + their own (item3)
        filtered = self.filter_backend.filter_queryset(request, qs, view)
        self.assertEqual(filtered.count(), 2)
        self.assertIn(self.item2, filtered)
        self.assertIn(self.item3, filtered)
        self.assertNotIn(self.item1, filtered)

    def test_visible_to_other(self):
        qs = JobItem.objects.all()
        request = self.factory.get('/')
        request.user = self.other
        view = MockView()
        
        filtered = self.filter_backend.filter_queryset(request, qs, view)
        self.assertEqual(filtered.count(), 1)
        self.assertEqual(filtered.first(), self.item2)
