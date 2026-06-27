from django.contrib.auth import get_user_model
from django.core.validators import FileExtensionValidator
from django.db import models
from cloudinary_storage.storage import VideoMediaCloudinaryStorage


# User = get_user_model()


class Multimedia(models.Model):
    # uploaded_by = models.ForeignKey(User, on_delete=models.DO_NOTHING)
    description = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now=True)
    

class Picture(Multimedia):
    img = models.ImageField(
        upload_to='videos/%Y/%m/%d/',
        validators=[FileExtensionValidator(
        allowed_extensions=['jpeg', 'jpg', 'png']
        )]
    )


class Video(Multimedia):
    video_file = models.FileField(
        upload_to='videos/%Y/%m/%d/',
        storage=VideoMediaCloudinaryStorage(),
        validators=[FileExtensionValidator(
        allowed_extensions=['mp4', 'webm', 'ogg']
        )]
    )