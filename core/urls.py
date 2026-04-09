from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'projects', views.ConstructionProjectViewSet, basename='project')
router.register(r'sites', views.ConstructionSiteViewSet, basename='site')
router.register(r'materials', views.MaterialViewSet, basename='material')
router.register(r'work-items', views.WorkItemViewSet, basename='work-item')
router.register(r'job-items', views.JobItemViewSet, basename='job-item')
router.register(r'job-reports', views.JobReportViewSet, basename='job-report')

app_name = 'core'

urlpatterns = [
    path('', include(router.urls)),
]
