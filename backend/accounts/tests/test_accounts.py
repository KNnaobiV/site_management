from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AuthErrorHandlingTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_login_missing_fields_returns_human_readable_errors(self):
        response = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Email or Username is required.", response.data.get("message", ""))
        self.assertIn("Password is required.", response.data.get("message", ""))

    def test_login_empty_fields_returns_human_readable_errors(self):
        response = self.client.post("/api/auth/login/", {"login": "", "password": ""}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Email or Username cannot be blank.", response.data.get("message", ""))
        self.assertIn("Password cannot be blank.", response.data.get("message", ""))

    def test_register_missing_fields_returns_human_readable_errors(self):
        response = self.client.post("/api/auth/register/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Username is required.", response.data.get("message", ""))
        self.assertIn("Email Address is required.", response.data.get("message", ""))
        self.assertIn("Password is required.", response.data.get("message", ""))
