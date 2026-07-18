from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from django.db.models import Q

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'display_name', 'profile_picture']


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
