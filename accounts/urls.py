from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('user/', views.UserDetailView.as_view(), name='user-detail'),
    path('users/search/', views.UserSearchView.as_view(), name='user-search'),
    path('password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
]
