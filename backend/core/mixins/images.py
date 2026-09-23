from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from core.models import Picture


class ImageHandlingMixin:
    """
    Mixin for ViewSets that need to handle image uploads and deletion.
    Requires the model to have a `photos` ManyToManyField to Picture.
    Subclasses should define `cover_image_field` (e.g., "job_image", "work_item_image").
    """
    cover_image_field = None

    def get_image_serializer_class(self):
        """Override to return the serializer for pictures"""
        raise NotImplementedError()

    @action(detail=True, methods=["post", "get", "delete"], url_path="images")
    def images(self, request, **kwargs):
        """GET/POST/DELETE images. POST expects multipart/form-data."""
        obj = self.get_object()
        serializer_class = self.get_image_serializer_class()

        if request.method == "GET":
            pics = list(obj.photos.all())
            cover = getattr(obj, self.cover_image_field, None) if self.cover_image_field else None
            if cover and cover not in pics:
                pics.insert(0, cover)
            return Response(serializer_class(pics, many=True, context=self.get_serializer_context()).data)

        if request.method == "DELETE":
            image_id = request.data.get("image_id") or request.query_params.get("image_id")
            if not image_id:
                return Response({"detail": "image_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            return self._remove_image(obj, image_id)

        # POST
        file_obj = request.FILES.get("img") or request.FILES.get("image")
        if not file_obj:
            return Response({"detail": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)
            
        caption = request.data.get("caption") or request.data.get("description", "")
        upload_to = request.data.get("upload_to") or getattr(obj, "upload_to", obj.default_upload_to)
        
        pic = Picture.objects.create(
            img=file_obj,
            description=caption,
            upload_to=upload_to
        )
        obj.photos.add(pic)
        
        if self.cover_image_field:
            cover = getattr(obj, self.cover_image_field, None)
            if not cover:
                setattr(obj, self.cover_image_field, pic)
                obj.save(update_fields=[self.cover_image_field])
                
        return Response(serializer_class(pic, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>[^/.]+)")
    def delete_image(self, request, image_id=None, **kwargs):
        """DELETE a specific image."""
        obj = self.get_object()
        return self._remove_image(obj, image_id)

    def _remove_image(self, obj, image_id):
        try:
            pic = Picture.objects.get(pk=image_id)
        except (Picture.DoesNotExist, ValueError):
            return Response({"detail": "Image not found."}, status=status.HTTP_404_NOT_FOUND)

        is_in_photos = obj.photos.filter(pk=pic.pk).exists()
        is_cover = False
        if self.cover_image_field:
            cover = getattr(obj, self.cover_image_field, None)
            is_cover = cover and cover.pk == pic.pk

        if not is_in_photos and not is_cover:
            return Response({"detail": "Image does not belong to this object."}, status=status.HTTP_400_BAD_REQUEST)

        if is_in_photos:
            obj.photos.remove(pic)

        if is_cover:
            next_pic = obj.photos.first()
            setattr(obj, self.cover_image_field, next_pic)
            obj.save(update_fields=[self.cover_image_field])

        pic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
