from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    ConstructionProject,
    ConstructionSite,
    Material,
    WorkItem,
    JobItem,
    JobReport,
)
from .serializers import (
    ConstructionProjectSerializer,
    ConstructionSiteSerializer,
    MaterialSerializer,
    WorkItemSerializer,
    JobItemSerializer,
    JobReportSerializer,
)


class ConstructionProjectViewSet(viewsets.ModelViewSet):
    queryset = ConstructionProject.objects.all()
    serializer_class = ConstructionProjectSerializer
    permission_classes = [IsAuthenticated]


class ConstructionSiteViewSet(viewsets.ModelViewSet):
    queryset = ConstructionSite.objects.all()
    serializer_class = ConstructionSiteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by project if provided"""
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(construction_project_id=project_id)
        return queryset


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]


class WorkItemViewSet(viewsets.ModelViewSet):
    queryset = WorkItem.objects.all()
    serializer_class = WorkItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by site if provided"""
        queryset = super().get_queryset()
        site_id = self.request.query_params.get('site_id')
        if site_id:
            queryset = queryset.filter(construction_site_id=site_id)
        return queryset


class JobItemViewSet(viewsets.ModelViewSet):
    queryset = JobItem.objects.all()
    serializer_class = JobItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by work_item if provided"""
        queryset = super().get_queryset()
        work_item_id = self.request.query_params.get('work_item_id')
        if work_item_id:
            queryset = queryset.filter(work_item_id=work_item_id)
        return queryset


class JobReportViewSet(viewsets.ModelViewSet):
    queryset = JobReport.objects.all()
    serializer_class = JobReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by job_item if provided"""
        queryset = super().get_queryset()
        job_item_id = self.request.query_params.get('job_item_id')
        if job_item_id:
            queryset = queryset.filter(job_item_id=job_item_id)
        return queryset
    
    def get_queryset(self):
        """Filter materials by report if provided"""
        queryset = super().get_queryset()
        report_id = self.request.query_params.get('report_id')
        if report_id:
            queryset = queryset.filter(daily_report_id=report_id)
        return queryset
