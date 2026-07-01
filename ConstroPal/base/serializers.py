# your_app/serializers.py
from rest_framework import serializers
from .models import Picture

class PictureSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    def get_image(self, obj):
        if not obj.img:
            return None
        url = obj.img.url
        # Cloudinary returns a full https:// URL; fall back to building absolute URI.
        if url and not url.startswith('http'):
            request = self.context.get('request')
            if request:
                url = request.build_absolute_uri(url)
        return url

    class Meta:
        model = Picture
        fields = ['id', 'image', 'created_at']