from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils import timezone

from .models import Invitation


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class InvitationSerializer(serializers.ModelSerializer):
    """Serializer used for creating invitation codes."""

    class Meta:
        model = Invitation
        fields = ['email']

    def create(self, validated_data):
        # Invitation.save() will generate code automatically
        return Invitation.objects.create(**validated_data)


class RegisterSerializer(serializers.ModelSerializer):
    invite_code = serializers.CharField(write_only=True, required=True)
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'invite_code', 'password', 'password2', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True},
        }

    def validate_invite_code(self, value):
        from .models import Invitation
        try:
            invite = Invitation.objects.get(code=value)
        except Invitation.DoesNotExist:
            raise serializers.ValidationError('Invalid invitation code.')
        if invite.used:
            raise serializers.ValidationError('Invitation code has already been used.')
        # optionally ensure the email matches if provided
        return value

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({
                'password': 'Passwords do not match.'
            })
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        invite_code = validated_data.pop('invite_code')
        user = User.objects.create_user(**validated_data)
        # mark invite used
        from .models import Invitation
        invite = Invitation.objects.get(code=invite_code)
        invite.used = True
        invite.used_at = timezone.now()
        invite.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        user = authenticate(
            username=data.get('username'),
            password=data.get('password')
        )
        if not user:
            raise serializers.ValidationError(
                'Invalid username or password.'
            )
        data['user'] = user
        return data
