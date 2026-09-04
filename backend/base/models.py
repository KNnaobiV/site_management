import posixpath
from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.validators import FileExtensionValidator
from django.db import models


def picture_upload_path(instance, filename):
    upload_to = getattr(instance, 'upload_to', None) or getattr(instance, 'img_save_location', None) or 'images/%Y/%m/%d/'
    if '%' in upload_to:
        upload_to = datetime.now().strftime(upload_to)
    upload_to = upload_to.strip().replace('\\', '/')
    return posixpath.join(upload_to, filename)


# User = get_user_model()


class Multimedia(models.Model):
    # uploaded_by = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    description = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now=True)


class HasPictureMixin:
    """
    Mixin for models referencing Picture via ForeignKey:
    - Accepts optional upload_to at instance creation (__init__)
    - Intercepts raw file uploads in kwargs before ForeignKey descriptor check
    - Automatically creates and associates Picture instances on save()
    """
    default_upload_to = 'images/%Y/%m/%d/'
    picture_fields = {}

    def __init__(self, *args, upload_to=None, **kwargs):
        self.upload_to = upload_to
        self._pending_pictures = {}

        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile

        fields = self.picture_fields if isinstance(self.picture_fields, (list, tuple, set)) else self.picture_fields.keys()
        for field in fields:
            if field in kwargs:
                val = kwargs.get(field)
                if val is not None and isinstance(val, (UploadedFile, File)):
                    self._pending_pictures[field] = kwargs.pop(field)

        super().__init__(*args, **kwargs)

    def save(self, *args, **kwargs):
        for field, file_obj in list(getattr(self, '_pending_pictures', {}).items()):
            target_path = getattr(self, 'upload_to', None)
            if not target_path:
                if isinstance(self.picture_fields, dict):
                    target_path = self.picture_fields.get(field, self.default_upload_to)
                else:
                    target_path = getattr(self, 'default_upload_to', 'images/%Y/%m/%d/')

            pic = Picture.objects.create(
                img=file_obj,
                upload_to=target_path
            )
            setattr(self, field, pic)
            del self._pending_pictures[field]

        fields = self.picture_fields if isinstance(self.picture_fields, (list, tuple, set)) else self.picture_fields.keys()
        for field in fields:
            val = getattr(self, field, None)
            if isinstance(val, Picture) and not val.pk:
                if getattr(self, 'upload_to', None):
                    val.upload_to = self.upload_to
                val.save()

        super().save(*args, **kwargs)


class Picture(Multimedia):
    upload_to = models.CharField(max_length=255, default='images/%Y/%m/%d/', blank=True)
    img = models.ImageField(
        upload_to=picture_upload_path,
        validators=[FileExtensionValidator(
            allowed_extensions=['jpeg', 'jpg', 'png', 'webp']
        )]
    )

    def __init__(self, *args, upload_to=None, img_save_location=None, **kwargs):
        target = upload_to or img_save_location
        if target is not None:
            kwargs['upload_to'] = target
        super().__init__(*args, **kwargs)

    @property
    def img_save_location(self):
        return self.upload_to

    @img_save_location.setter
    def img_save_location(self, value):
        self.upload_to = value

    def __str__(self):
        return f"Picture {self.id or ''} ({self.img.name if self.img else 'no file'})"


class Video(Multimedia):
    video_file = models.FileField(
        upload_to='videos/%Y/%m/%d/',
        validators=[FileExtensionValidator(
            allowed_extensions=['mp4', 'webm', 'ogg']
        )]
    )