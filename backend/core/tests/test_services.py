from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem, Notification
from core.services.authorization import AuthorizationService
from core.services.notifications import NotificationService

User = get_user_model()


class AuthorizationServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="creator", email="owner@example.com", password="password")
        self.pm = User.objects.create_user(username="pm", email="pm@example.com", password="password")
        self.foreman = User.objects.create_user(username="foreman", email="foreman@example.com", password="password")
        self.bystander = User.objects.create_user(username="bystander", email="bystander@example.com", password="password")

        self.project = ConstructionProject.objects.create(
            project_name="Test Project", 
            created_by=self.owner,
            project_manager=self.pm,
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project, address="123 Test St"
        )
        self.plot.foremen.add(self.foreman)
        
        self.work_item = WorkItem.objects.create(
            construction_plot=self.plot, name="Test Work Item", created_by=self.owner
        )
        self.job_item = JobItem.objects.create(
            work_item=self.work_item, job_name="Test Job Item", created_by=self.owner
        )

    def test_role_for_project(self):
        auth_owner = AuthorizationService(self.owner)
        self.assertEqual(auth_owner.role_for(self.project), "creator")
        
        auth_pm = AuthorizationService(self.pm)
        self.assertEqual(auth_pm.role_for(self.project), "project_manager")
        
        auth_bystander = AuthorizationService(self.bystander)
        self.assertEqual(auth_bystander.role_for(self.project), "none")

    def test_role_for_plot(self):
        auth_foreman = AuthorizationService(self.foreman)
        self.assertEqual(auth_foreman.role_for(self.plot), "foreman")
        self.assertEqual(auth_foreman.role_for(self.job_item), "foreman")

    def test_can_manage_project(self):
        self.assertTrue(AuthorizationService(self.owner).can_manage_project(self.project))
        self.assertTrue(AuthorizationService(self.pm).can_manage_project(self.project))
        self.assertFalse(AuthorizationService(self.foreman).can_manage_project(self.project))

    def test_can_manage_plot(self):
        self.assertTrue(AuthorizationService(self.owner).can_manage_plot(self.plot))
        self.assertTrue(AuthorizationService(self.pm).can_manage_plot(self.plot))
        self.assertTrue(AuthorizationService(self.foreman).can_manage_plot(self.plot))
        self.assertFalse(AuthorizationService(self.bystander).can_manage_plot(self.plot))


class NotificationServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner_notif", email="owner_notif@example.com", password="password")
        self.pm = User.objects.create_user(username="pm_notif", email="pm_notif@example.com", password="password")
        self.client = User.objects.create_user(username="client_notif", email="client_notif@example.com", password="password")
        self.foreman = User.objects.create_user(username="foreman_notif", email="foreman_notif@example.com", password="password")

        self.project = ConstructionProject.objects.create(
            project_name="Test Notif Project", 
            created_by=self.owner,
            project_manager=self.pm,
            client=self.client,
        )
        self.plot = ConstructionPlot.objects.create(
            construction_project=self.project, address="123 Notif St"
        )
        self.plot.foremen.add(self.foreman)

    def test_project_members(self):
        service = NotificationService(project=self.project)
        members = service.project_members()
        self.assertIn(self.owner, members)
        self.assertIn(self.pm, members)
        self.assertIn(self.client, members)
        self.assertIn(self.foreman, members)

    def test_plot_members(self):
        service = NotificationService(plot=self.plot)
        members = service.plot_members()
        self.assertIn(self.owner, members)
        self.assertIn(self.pm, members)
        self.assertIn(self.client, members)
        self.assertIn(self.foreman, members)

    def test_send_to_with_exclude(self):
        service = NotificationService(project=self.project)
        users = {self.owner, self.pm, self.client}
        notifications = service.send_to(users, message="Test msg", exclude={self.owner})
        self.assertEqual(len(notifications), 2)
        received_users = {n.user for n in notifications}
        self.assertIn(self.pm, received_users)
        self.assertIn(self.client, received_users)
        self.assertNotIn(self.owner, received_users)
