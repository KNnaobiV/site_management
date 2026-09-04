from rest_framework import serializers
from .models import Picture, Video


class PictureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Picture
        fields = ['id', 'img', 'upload_to', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ['id', 'video_file', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']
