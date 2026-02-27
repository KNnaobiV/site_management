from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('user/', views.UserDetailView.as_view(), name='user-detail'),
    path('invite/', views.InvitationCreateView.as_view(), name='invite-create'),
]
