from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Registration & email confirmation
    path('register/', views.RegisterView.as_view(), name='register'),
    path('confirm-email/', views.EmailConfirmView.as_view(), name='confirm-email'),
    path('resend-confirmation/', views.ResendEmailConfirmView.as_view(), name='resend-confirmation'),

    # Login / Logout  (email or username accepted)
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),

    # JWT token refresh — POST { "refresh": "<token>" } → { "access": "<new_token>" }
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # Social login
    path('social/google/', views.GoogleSocialLoginView.as_view(), name='social-google-login'),
    path('social/apple/', views.AppleSocialLoginView.as_view(), name='social-apple-login'),

    # User profile
    path('user/', views.UserDetailView.as_view(), name='user-detail'),
    path('users/search/', views.UserSearchView.as_view(), name='user-search'),

    # Password management
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
]
