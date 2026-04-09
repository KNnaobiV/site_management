from rest_framework import serializers
from .models import (
    ConstructionProject,
    ConstructionSite,
    Material,
    WorkItem,
    JobItem,
    JobReport,
)


class ConstructionProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionProject
        fields = '__all__'


class ConstructionSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionSite
        fields = '__all__'


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = '__all__'


class WorkItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkItem
        fields = '__all__'


class JobItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobItem
        fields = '__all__'


class JobReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobReport
        exclude = ['report_status']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and not request.user.is_staff:
            # If the user is not staff, limit the fields they can see
            allowed_fields = {
                'id', 
                'job_item', 
                'report_date', 
                'progress_percentage', 
                'issues_encountered'
            }
            for field_name in set(self.fields) - allowed_fields:
                self.fields.pop(field_name)
        if request.user == request.context['view'].get_object().job_item.\
            work_item.construction_site.construction_project.project_manager:
            # If the user is the project manager of the site
            fields += ['report_status']