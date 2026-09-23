from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem
from core.filters.approval_visibility import visible_to_user, approved_only

User = get_user_model()


class ApprovalVisibilityFilterTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="password")
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

    def test_visible_to_owner(self):
        qs = JobItem.objects.all()
        # Owner sees everything
        filtered = visible_to_user(qs, self.owner, role="owner")
        self.assertEqual(filtered.count(), 3)

    def test_visible_to_foreman(self):
        qs = JobItem.objects.all()
        # Foreman sees approved (item2) + their own (item3)
        filtered = visible_to_user(qs, self.foreman, role="foreman")
        self.assertEqual(filtered.count(), 2)
        self.assertIn(self.item2, filtered)
        self.assertIn(self.item3, filtered)
        self.assertNotIn(self.item1, filtered)

    def test_approved_only(self):
        qs = JobItem.objects.all()
        filtered = approved_only(qs)
        self.assertEqual(filtered.count(), 1)
        self.assertEqual(filtered.first(), self.item2)
