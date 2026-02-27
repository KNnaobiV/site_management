from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User

from .serializers import UserSerializer, RegisterSerializer, LoginSerializer, InvitationSerializer


class RegisterView(APIView):
    """
    API view for user registration.
    POST: Register a new user with username, email, password and a valid invite code.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key,
                'message': 'User registered successfully.'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InvitationCreateView(APIView):
    """API view to create invitation codes.

    Only admin or staff users may generate invitations. The invitation is sent
    back in the response; the email provided is optional but can be used to
    tie the code to a specific address.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # only allow staff or superusers
        if not request.user.is_staff:
            return Response({'detail': 'Not authorized to create invitations.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = InvitationSerializer(data=request.data)
        if serializer.is_valid():
            invite = serializer.save()
            return Response({
                'code': invite.code,
                'email': invite.email,
                'message': 'Invitation created.'
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
            token, created = Token.objects.get_or_create(user=user)
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
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
