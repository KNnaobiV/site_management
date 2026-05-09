from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model

from .serializers import UserSerializer, RegisterSerializer, LoginSerializer

User = get_user_model()

class RegisterView(APIView):
    """
    API view for user registration.
    POST: Register a new user with username, email and password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key,
                'message': 'User registered successfully.'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    API view for user login.
    POST: Login with username and password to get authentication token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key,
                'message': 'Logged in successfully.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    API view for user logout.
    POST: Delete the user's authentication token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response({
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)


class UserDetailView(APIView):
    """
    API view to retrieve authenticated user details.
    GET: Get the current logged-in user's information.
    PATCH: Update the current user's profile information.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    """
    API view to request a password reset.
    POST: Send a password reset email (mocked).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Mocking email sending logic
        # In a real app, you would use django.core.mail.send_mail and a token system
        return Response({'message': f'If an account exists with email {email}, a reset link has been sent.'}, status=status.HTTP_200_OK)


class UserSearchView(APIView):
    """
    GET /auth/users/search/?q=<username_or_email>
    Returns up to 10 matching users (excludes the requesting user).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([], status=status.HTTP_200_OK)
        users = User.objects.filter(
            Q(username__icontains=q) | Q(email__icontains=q)
        ).exclude(pk=request.user.pk)[:10]
        return Response(UserSerializer(users, many=True).data)

