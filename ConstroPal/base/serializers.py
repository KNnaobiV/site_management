# your_app/serializers.py
from rest_framework import serializers
from .models import Picture

class PictureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Picture
        fields = ['id', 'image_file']