import uuid
from django.contrib.auth import get_user_model
from backend.core.models import (
    ConstructionProject, 
    ConstructionPlot, 
    WorkItem, 
    JobItem, 
    JobReport, 
    Expense, 
    ProjectInvitation, 
    PlotInvitation
)

User = get_user_model()

class UserFactory:
    @staticmethod
    def create(username=None, email=None, password="Password123!"):
        if not username:
            username = f"user_{uuid.uuid4().hex[:8]}"
        if not email:
            email = f"{username}@example.com"
            
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email}
        )
        if created:
            user.set_password(password)
            user.save()
        return user


class ProjectFactory:
    @staticmethod
    def create(name=None, creator=None, pm=None, budget=None, start_date="2026-01-01", target_end_date="2026-12-31"):
        if not name:
            name = f"QA Project {uuid.uuid4().hex[:8]}"
        if not creator:
            creator = UserFactory.create()
            
        project = ConstructionProject.objects.create(
            project_name=name,
            created_by=creator,
            project_manager=pm,
            budget=budget,
            start_date=start_date,
            target_end_date=target_end_date,
            description="QA Test Project"
        )
        return project


class PlotFactory:
    @staticmethod
    def create(project, name=None, budget=None, start_date="2026-01-01", target_end_date="2026-12-31"):
        if not name:
            name = f"QA Plot {uuid.uuid4().hex[:8]}"
            
        plot = ConstructionPlot.objects.create(
            construction_project=project,
            plot_name=name,
            budget=budget,
            start_date=start_date,
            target_end_date=target_end_date,
            description="QA Test Plot"
        )
        return plot


class WorkFactory:
    @staticmethod
    def create(plot, name=None, budget=None, start_date="2026-01-01", target_end_date="2026-12-31"):
        if not name:
            name = f"QA Work {uuid.uuid4().hex[:8]}"
            
        work = WorkItem.objects.create(
            construction_plot=plot,
            work_name=name,
            budget=budget,
            start_date=start_date,
            target_end_date=target_end_date,
            description="QA Test Work"
        )
        return work


class JobFactory:
    @staticmethod
    def create(work, name=None, budget=None, target_end_date="2026-12-31", is_completed=False):
        if not name:
            name = f"QA Job {uuid.uuid4().hex[:8]}"
            
        job = JobItem.objects.create(
            work_item=work,
            job_name=name,
            budget=budget,
            target_end_date=target_end_date,
            description="QA Test Job",
            is_completed=is_completed
        )
        return job

class ReportFactory:
    @staticmethod
    def create(job, reporter, description="QA Report", status="pending"):
        report = JobReport.objects.create(
            job_item=job,
            reported_by=reporter,
            description=description,
            approval_status=status
        )
        return report
