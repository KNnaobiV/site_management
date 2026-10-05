from backend.core.models import (
    ConstructionProject, 
    ConstructionPlot, 
    WorkItem, 
    JobItem
)

def get_project_by_name(name):
    return ConstructionProject.objects.filter(project_name=name).first()

def get_plot_by_name(name):
    return ConstructionPlot.objects.filter(plot_name=name).first()

def get_work_by_name(name):
    return WorkItem.objects.filter(work_name=name).first()

def get_job_by_name(name):
    return JobItem.objects.filter(job_name=name).first()
