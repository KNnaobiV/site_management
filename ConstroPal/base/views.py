from rest_framework.viewsets import ModelViewSet
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Picture
from .serializers import PictureSerializer

class PictureViewSet(ModelViewSet):
    queryset = Picture.objects.all()
    serializer_class = PictureSerializer
    # FormParser and MultiPartParser are required to handle file uploads
    parser_classes = [MultiPartParser, FormParser]