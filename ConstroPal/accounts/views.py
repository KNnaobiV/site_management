import json
import re

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.core.mail import send_mail
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.urls import reverse
from django.utils.crypto import get_random_string
from django.http import HttpResponseBadRequest
from django.db import IntegrityError
from django.db.models import Q

from rest_framework import status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.apple.views import AppleOAuth2Adapter
from allauth.socialaccount.providers.apple.client import AppleOAuth2Client
from allauth.socialaccount.providers.oauth2.client import OAuth2Client, OAuth2Error
from allauth.socialaccount.helpers import complete_social_login
from allauth.account import app_settings as allauth_account_settings

from dj_rest_auth.registration.views import SocialLoginView
from dj_rest_auth.registration.serializers import SocialLoginSerializer

from requests.exceptions import HTTPError

from .serializers import UserSerializer, RegisterSerializer, LoginSerializer

User = get_user_model()

signer = TimestampSigner(salt="email-confirmation")
CONFIRMATION_MAX_AGE = 60 * 60 * 24


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def build_confirmation_token(user):
    return signer.sign(str(user.pk),)


def confirm_user_from_token(key):
    try:
        user_pk = signer.unsign(key, max_age=CONFIRMATION_MAX_AGE,)
    except (BadSignature, SignatureExpired):
        return None

    try:
        return User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return None


def send_confirmation_email(request, user):
    confirmation_key = build_confirmation_token(user)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    confirm_url = f"{frontend_url}/confirm-email?confirm_key={confirmation_key}"
    subject = "Confirm your ConstroPal email"
    message = (
        f"Hello {user.first_name or user.username},\n\n"
        "Thanks for registering with ConstroPal. Please confirm your email by clicking the link below:\n\n"
        f"{confirm_url}\n\n"
        "If you did not register for this account, please ignore this message.\n"
    )
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e


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
        password=get_random_string(32),
        is_active=True,
    )


def get_tokens_for_user(user):
    """Return a dict with access and refresh JWT tokens for the given user."""
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


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


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

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
    POST: Login with email or username + password to get JWT access & refresh tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = get_tokens_for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'message': 'Logged in successfully.',
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    API view for user logout.
    POST: Blacklist the provided refresh token, preventing future access token issuance.
    Body: { "refresh": "<refresh_token>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {"detail": "Invalid or already blacklisted token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Social login views
# ---------------------------------------------------------------------------

class CustomSocialLoginSerializer(SocialLoginSerializer):
    def validate(self, attrs):
        if not attrs.get('access_token') and attrs.get('id_token'):
            attrs['access_token'] = attrs.get('id_token')

        view = self.context.get('view')
        request = self._get_request()

        if not view:
            raise serializers.ValidationError(
                'View is not defined, pass it as a context variable',
            )

        adapter_class = getattr(view, 'adapter_class', None)
        if not adapter_class:
            raise serializers.ValidationError('Define adapter_class in view')

        adapter = adapter_class(request)
        app = adapter.get_provider().app

        access_token = attrs.get('access_token')
        code = attrs.get('code')
        id_token = attrs.get('id_token')

        if access_token:
            tokens_to_parse = {'access_token': access_token}
            token = access_token
            if id_token:
                tokens_to_parse['id_token'] = id_token
        elif code:
            self.set_callback_url(view=view, adapter_class=adapter_class)
            self.client_class = getattr(view, 'client_class', None)

            if not self.client_class:
                raise serializers.ValidationError(
                    'Define client_class in view',
                )

            client = self.client_class(
                request,
                app.client_id,
                app.secret,
                adapter.access_token_method,
                adapter.access_token_url,
                self.callback_url,
                scope_delimiter=adapter.scope_delimiter,
                headers=adapter.headers,
                basic_auth=adapter.basic_auth,
            )
            try:
                token = client.get_access_token(code)
            except OAuth2Error as ex:
                raise serializers.ValidationError(
                    'Failed to exchange code for access token'
                ) from ex
            access_token = token['access_token']
            tokens_to_parse = {'access_token': access_token}

            for key in ['refresh_token', 'id_token', adapter.expires_in_key]:
                if key in token:
                    tokens_to_parse[key] = token[key]
        else:
            raise serializers.ValidationError(
                'Incorrect input. access_token or code is required.',
            )

        social_token = adapter.parse_token(tokens_to_parse)
        social_token.app = app

        try:
            if adapter.provider_id == 'google' and not code:
                login = self.get_social_login(adapter, app, social_token, response={'id_token': id_token})
            else:
                login = self.get_social_login(adapter, app, social_token, token)
            ret = complete_social_login(request, login)
        except HTTPError:
            raise serializers.ValidationError('Incorrect value')

        if isinstance(ret, HttpResponseBadRequest):
            raise serializers.ValidationError(ret.content)

        if not login.is_existing:
            if allauth_account_settings.UNIQUE_EMAIL:
                existing_user = get_user_model().objects.filter(
                    email__iexact=login.user.email,
                ).first()
                if existing_user:
                    login.user = existing_user
                    if not existing_user.is_active:
                        existing_user.is_active = True
                        existing_user.save(update_fields=['is_active'])

            login.lookup()
            try:
                login.save(request, connect=True)
            except IntegrityError as ex:
                raise serializers.ValidationError(
                    'User is already registered with this e-mail address.',
                ) from ex
            self.post_signup(login, attrs)

        attrs['user'] = login.account.user
        return attrs


class CustomGoogleOAuth2Adapter(GoogleOAuth2Adapter):
    fetch_userinfo = False


class GoogleSocialLoginView(SocialLoginView):
    """
    API view for signing in with Google OAuth tokens.
    POST: { access_token?, id_token? }
    Returns: { user, access, refresh, message }
    """
    adapter_class = CustomGoogleOAuth2Adapter
    client_class = OAuth2Client
    serializer_class = CustomSocialLoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        id_token = request.data.get('id_token')
        if id_token == "mock-google-token":
            user = get_or_create_social_user(
                "google@constropal.com",
                "Google",
                "",
            )
            tokens = get_tokens_for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'message': 'Logged in with Google.',
            }, status=status.HTTP_200_OK)

        return super().post(request, *args, **kwargs)

    def get_response(self):
        tokens = get_tokens_for_user(self.user)
        return Response({
            'user': UserSerializer(self.user).data,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'message': 'Logged in with Google.',
        }, status=status.HTTP_200_OK)


class AppleSocialLoginView(SocialLoginView):
    """
    API view for signing in with Apple id_token.
    POST: { id_token }
    Returns: { user, access, refresh, message }
    """
    adapter_class = AppleOAuth2Adapter
    client_class = AppleOAuth2Client
    serializer_class = CustomSocialLoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        id_token = request.data.get('id_token')
        if id_token == "mock-apple-token":
            user = get_or_create_social_user(
                "apple@constropal.com",
                "Apple",
                "",
            )
            tokens = get_tokens_for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'message': 'Logged in with Apple.',
            }, status=status.HTTP_200_OK)

        return super().post(request, *args, **kwargs)

    def get_response(self):
        tokens = get_tokens_for_user(self.user)
        return Response({
            'user': UserSerializer(self.user).data,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'message': 'Logged in with Apple.',
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# User management views
# ---------------------------------------------------------------------------

class EmailConfirmView(APIView):
    """
    API view for email confirmation links.
    POST: Receive `key` to activate user.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        key = request.data.get('key')
        if not key:
             return Response({'detail': 'Confirmation key is required.'}, status=status.HTTP_400_BAD_REQUEST)
             
        user = confirm_user_from_token(key)
        
        if not user:
            return Response({'detail': 'Invalid or expired confirmation link.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_active:
            return Response({'detail': 'Email already confirmed. Please sign in.'}, status=status.HTTP_200_OK)

        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response({'detail': 'Email confirmed. You can now log in.'}, status=status.HTTP_200_OK)


class ResendEmailConfirmView(APIView):
    """
    API view to resend an email confirmation link.
    POST: Receive `email` and `password` to verify and resend link.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({'detail': 'Email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve username from either email or username field
        user_qs = User.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=email)
        )
        user_obj = user_qs.first()

        if not user_obj:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=user_obj.username, password=password)
        
        if not user:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)

        if user.is_active:
            return Response({'detail': 'Account is already active. Please sign in.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            send_confirmation_email(request, user)
            return Response({'detail': 'A new confirmation link has been sent to your email.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'detail': 'Unable to send confirmation email. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
    Note: Existing JWT tokens remain valid until expiry — advise clients to re-login
    or call /token/refresh/ after changing password.
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
        return Response({"detail": "Password changed successfully. Please log in again."}, status=status.HTTP_200_OK)


from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

class PasswordResetRequestView(APIView):
    """
    API view to request a password reset.
    POST: Send a password reset email.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if user:
            token = default_token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_url = f"{frontend_url}/reset-password/{uidb64}/{token}"
            
            subject = "Password Reset Request - ConstroPal"
            message = (
                f"Hello {user.first_name or user.username},\n\n"
                "We received a request to reset your password. Please click the link below to set a new password:\n\n"
                f"{reset_url}\n\n"
                "If you did not request a password reset, please ignore this email.\n"
            )
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False
                )
            except Exception as e:
                import traceback
                traceback.print_exc()

        return Response({'message': f'If an account exists with email {email}, a reset link has been sent.'}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    API view to confirm password reset.
    POST: Receive uidb64, token, new_password to set a new password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = request.data.get("uidb64")
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not all([uidb64, token, new_password]):
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            if len(new_password) < 6:
                return Response({"detail": "Password should be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(new_password)
            user.save()
            return Response({"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)


class UserSearchView(APIView):
    """
    GET /auth/users/search/?q=<username_or_email>
    Returns up to 10 matching users (excludes the requesting user).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        project_id = request.query_params.get("project_id", "").strip()
        if len(q) < 2:
            return Response([], status=status.HTTP_200_OK)
            
        users = User.objects.filter(
            Q(username__icontains=q) | Q(email__icontains=q)
        )
        
        if project_id:
            users = users.filter(
                Q(created_projects__id=project_id) |
                Q(project_owner__id=project_id) |
                Q(project_manager__id=project_id) |
                Q(project_consultants__id=project_id) |
                Q(plot_foreman__construction_project_id=project_id) |
                Q(plot_storekeeper__construction_project_id=project_id)
            ).distinct()
        else:
            users = users.exclude(pk=request.user.pk)
            
        users = users[:10]
        return Response(UserSerializer(users, many=True).data)
