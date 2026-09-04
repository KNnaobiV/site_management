from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from django.db.models import Q

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'display_name', 'profile_picture']

    def get_profile_picture(self, obj):
        if obj.profile_picture and obj.profile_picture.img:
            request = self.context.get('request')
            url = obj.profile_picture.img.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None

    def update(self, instance, validated_data):
        profile_picture_data = self.initial_data.get('profile_picture')
        from django.core.files.base import File
        from django.core.files.uploadedfile import UploadedFile
        from base.models import Picture

        if profile_picture_data and isinstance(profile_picture_data, (UploadedFile, File)):
            pic = Picture.objects.create(
                img=profile_picture_data,
                upload_to=getattr(instance, 'upload_to', instance.default_upload_to)
            )
            instance.profile_picture = pic
        elif isinstance(profile_picture_data, (int, str)) and str(profile_picture_data).isdigit():
            instance.profile_picture_id = int(profile_picture_data)

        return super().update(instance, validated_data)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True},
        }

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({
                'password': 'Passwords do not match.'
            })
        return data

    def create(self, validated_data, **kwargs):
        validated_data.pop('password2')
        return User.objects.create_user(**validated_data, **kwargs)


class LoginSerializer(serializers.Serializer):
    """
    Accepts login (email or username) and password.
    Resolves the user by checking both fields, then authenticates.
    """
    login = serializers.CharField(
        required=True,
        help_text="Your email address or username."
    )
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        login = data.get('login', '').strip()
        password = data.get('password')

        # Resolve username from either email or username field
        user_qs = User.objects.filter(
            Q(email__iexact=login) | Q(username__iexact=login)
        )
        user_obj = user_qs.first()

        if not user_obj:
            raise serializers.ValidationError(
                'No account found with that email or username.'
            )

        # Authenticate using the resolved username
        user = authenticate(username=user_obj.username, password=password)
        if not user:
            raise serializers.ValidationError(
                'Invalid credentials. Please check your password.'
            )

        if not user.is_active:
            raise serializers.ValidationError(
                'Account is not active. Please confirm your email before logging in.'
            )

        data['user'] = user
        return data
