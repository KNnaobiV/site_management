import json
import re

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .serializers import UserSerializer, RegisterSerializer, LoginSerializer

User = get_user_model()

signer = TimestampSigner()
CONFIRMATION_MAX_AGE = 60 * 60 * 24


def build_confirmation_token(user):
    return signer.sign(str(user.pk), salt="email-confirmation")


def confirm_user_from_token(key):
    try:
        user_pk = signer.unsign(key, max_age=CONFIRMATION_MAX_AGE, salt="email-confirmation")
    except (BadSignature, SignatureExpired):
        return None

    try:
        return User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return None


def send_confirmation_email(request, user):
    confirmation_key = build_confirmation_token(user)
    confirm_url = request.build_absolute_uri(reverse("confirm-email", args=[confirmation_key]))
    subject = "Confirm your ConstroPal email"
    message = (
        f"Hello {user.first_name or user.username},\n\n"
        "Thanks for registering with ConstroPal. Please confirm your email by clicking the link below:\n\n"
        f"{confirm_url}\n\n"
        "If you did not register for this account, please ignore this message.\n"
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)


def normalize_username(value):
    base = re.sub(r"[^a-zA-Z0-9._-]+", "", value).lower() or "user"
    candidate = base
    counter = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


def get_or_create_social_user(email, first_name="", last_name=""):
    user = User.objects.filter(email__iexact=email).first()
    if user:
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        return user

    username = normalize_username(email.split("@")[0])
    return User.objects.create_user(
        username=username,
        email=email,
        first_name=first_name or "",
        last_name=last_name or "",
        password=User.objects.make_random_password(),
        is_active=True,
    )


def get_google_profile(access_token=None, id_token=None):
    if not access_token and not id_token:
        raise ValueError("Either access_token or id_token is required for Google login.")

    if id_token:
        response = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
        profile = response.json()
        if response.status_code != 200:
            raise ValueError(profile.get("error_description") or profile.get("error") or "Invalid Google id_token.")
    else:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        profile = response.json()
        if response.status_code != 200:
            raise ValueError(profile.get("error_description") or profile.get("error") or "Invalid Google access_token.")

    if settings.GOOGLE_CLIENT_ID and profile.get("aud") and profile.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google token audience does not match configured client ID.")

    email = profile.get("email")
    if not email:
        raise ValueError("Google login did not return an email address.")

    email_verified = str(profile.get("email_verified", "false")).lower() in ["true", "1", "yes"]
    if not email_verified:
        raise ValueError("Google account email is not verified.")

    first_name = profile.get("given_name") or profile.get("name", "").split(" ", 1)[0]
    last_name = profile.get("family_name") or (profile.get("name", "").split(" ", 1)[1] if " " in profile.get("name", "") else "")
    return {"email": email, "first_name": first_name, "last_name": last_name}


def get_apple_profile(id_token):
    if not id_token:
        raise ValueError("id_token is required for Apple login.")

    response = requests.get("https://appleid.apple.com/auth/keys", timeout=10)
    jwks = response.json()
    headers = jwt.get_unverified_header(id_token)
    key_data = next((item for item in jwks.get("keys", []) if item.get("kid") == headers.get("kid")), None)
    if not key_data:
        raise ValueError("Could not find matching Apple public key.")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
    audience = settings.APPLE_CLIENT_ID or None
    payload = jwt.decode(
        id_token,
        public_key,
        audience=audience,
        issuer="https://appleid.apple.com",
        algorithms=["RS256"],
    )

    email = payload.get("email")
    if not email:
        raise ValueError("Apple login did not return an email address.")

    return {
        "email": email,
        "first_name": "",
        "last_name": "",
    }


class RegisterView(APIView):
    """
    API view for user registration.
    POST: Register a new user with username, email and password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save(is_active=False)
            try:
                send_confirmation_email(request, user)
            except Exception:
                user.delete()
                return Response({
                    'detail': 'Unable to send confirmation email. Please try again later.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({
                'message': 'Registration successful. Please check your email to confirm your account.'
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


class GoogleSocialLoginView(APIView):
    """
    API view for signing in with Google OAuth tokens.
    POST: { access_token?, id_token? }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            profile = get_google_profile(
                access_token=request.data.get('access_token'),
                id_token=request.data.get('id_token'),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = get_or_create_social_user(
            profile['email'],
            profile['first_name'],
            profile['last_name'],
        )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'Logged in with Google.',
        }, status=status.HTTP_200_OK)


class AppleSocialLoginView(APIView):
    """
    API view for signing in with Apple id_token.
    POST: { id_token }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            profile = get_apple_profile(request.data.get('id_token'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = get_or_create_social_user(
            profile['email'],
            profile['first_name'],
            profile['last_name'],
        )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'Logged in with Apple.',
        }, status=status.HTTP_200_OK)


class EmailConfirmView(APIView):
    """
    API view for email confirmation links.
    GET: Activate the user associated with the confirmation token.
    """
    permission_classes = [AllowAny]

    def get(self, request, key):
        user = confirm_user_from_token(key)
        if not user:
            return Response({'detail': 'Invalid or expired confirmation link.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_active:
            return Response({'detail': 'Email already confirmed.'}, status=status.HTTP_200_OK)

        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response({'detail': 'Email confirmed. You can now log in.'}, status=status.HTTP_200_OK)


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


class ChangePasswordView(APIView):
    """
    API view to change authenticated user's password.
    POST: Update the user's password.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        
        if not old_password or not new_password:
            return Response({"detail": "Old and new passwords are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        if not user.check_password(old_password):
            return Response({"detail": "Incorrect old password."}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)


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

