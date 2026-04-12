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
    is_staff = models.BooleanField(default=False)
    
    USERNAME_FIELD = 'username, email'
    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username
