from core.services.notifications import NotificationService
from core.models import JobReport

class ApprovalService:
    def __init__(self, user):
        self.user = user

    def approve(self, obj, *, message=""):
        return self._set_approval(obj, True, message)

    def reject(self, obj, *, message=""):
        return self._set_approval(obj, False, message)

    def _set_approval(self, obj, approved, message):
        obj_type = getattr(obj.__class__, "__name__", "")
        
        target_url = ""
        if obj_type == "JobItem":
            obj.is_approved = approved
            obj.save(update_fields=["is_approved"])
            target_url = f"/job-items/{obj.pk}/"
        elif obj_type == "JobReport":
            obj.report_status = JobReport.ReportStatusChoices.approved if approved else JobReport.ReportStatusChoices.rejected
            obj.save(update_fields=["report_status", "updated_at"])
            target_url = f"/job-items/{obj.job_item.pk}?report={obj.pk}"
        elif obj_type == "WorkItem":
            obj.is_approved = approved
            obj.save(update_fields=["is_approved"])
            target_url = f"/work-items/{obj.pk}/"
        else:
            raise ValueError(f"Unsupported approval object type: {obj_type}")

        # Notify
        scope = getattr(obj, "construction_plot", None)
        if not scope and hasattr(obj, "job_item"):
            scope = getattr(obj.job_item.work_item, "construction_plot", None)
        elif not scope and hasattr(obj, "work_item"):
            scope = getattr(obj.work_item, "construction_plot", None)

        if scope:
            notif_service = NotificationService(plot=scope)
            notif_service.notify_approval(
                obj, 
                actor=self.user, 
                approved=approved, 
                message=message,
                target_url=target_url,
            )
            
        return obj
