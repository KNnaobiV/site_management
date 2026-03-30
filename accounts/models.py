import uuid

from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone


class UserModel(AbstractBaseUser):
    """Custom user model that can be extended in the future if needed."""
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)

    USERNAME_FIELD = 'username, email'
    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username


class Invitation(models.Model):
    """Invitation token that allows a new user to register.

    Invitations are single-use and can optionally be tied to an email address
    to prevent sharing. A code is generated automatically when the record is
    created.
    """

    email = models.EmailField(blank=True, help_text="Optional email address for the invite.")
    code = models.CharField(max_length=64, unique=True, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who created this invitation, if any.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.code:
            # use uuid4 hex for reasonably short unique string
            self.code = uuid.uuid4().hex
        super().save(*args, **kwargs)

    def mark_used(self):
        self.used = True
        self.used_at = timezone.now()
        self.save()

    def __str__(self):
        return f"Invitation {self.code} (used={self.used})"
