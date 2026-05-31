from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('confirm-email/<str:key>/', views.EmailConfirmView.as_view(), name='confirm-email'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('social/google/', views.GoogleSocialLoginView.as_view(), name='social-google-login'),
    path('social/apple/', views.AppleSocialLoginView.as_view(), name='social-apple-login'),
    path('user/', views.UserDetailView.as_view(), name='user-detail'),
    path('users/search/', views.UserSearchView.as_view(), name='user-search'),
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
]
