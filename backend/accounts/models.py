import uuid

from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class UserModel(AbstractUser):
    """Custom user model that can be extended in the future if needed."""
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    is_staff = models.BooleanField(default=False)
    
    default_upload_to = 'profiles/'
    display_name = models.CharField(max_length=50, blank=True, null=True)
    profile_picture = models.ForeignKey(
        'base.Picture',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_profiles'
    )

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    def __init__(self, *args, upload_to=None, **kwargs):
        self.upload_to = upload_to or self.default_upload_to
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        self._pending_profile_picture = None
        if 'profile_picture' in kwargs:
            raw_pic = kwargs.get('profile_picture')
            if raw_pic is not None and isinstance(raw_pic, (UploadedFile, File)):
                self._pending_profile_picture = kwargs.pop('profile_picture')
        super().__init__(*args, **kwargs)

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        if not self.display_name:
            self.display_name = f"{self.first_name}"

        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        from base.models import Picture

        if getattr(self, '_pending_profile_picture', None):
            self.profile_picture = Picture.objects.create(
                img=self._pending_profile_picture,
                upload_to=getattr(self, 'upload_to', self.default_upload_to)
            )
            self._pending_profile_picture = None
        elif isinstance(self.profile_picture, Picture) and not self.profile_picture.pk:
            if getattr(self, 'upload_to', None):
                self.profile_picture.upload_to = self.upload_to
            self.profile_picture.save()

        super().save(*args, **kwargs)