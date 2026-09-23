from rest_framework.decorators import action
from rest_framework.response import Response
from core.services.approval import ApprovalService
from core.models import JobReport

class ApprovalMixin:
    """
    Mixin for ViewSets that need approve/reject endpoints.
    Requires that the ViewSet uses permissions that check action == "approve" or "reject"
    """

    @action(detail=True, methods=["post"])
    def approve(self, request, **kwargs):
        obj = self.get_object()
        # ViewSet permission classes should handle if user is allowed to approve
        
        message = request.data.get("message", request.data.get("reason", ""))
        service = ApprovalService(request.user)
        service.approve(obj, message=message)
        
        response_data = {"status": "approved"}
        if getattr(obj.__class__, "__name__", "") == "JobReport":
            response_data["report_status"] = obj.report_status
            
        return Response(response_data)

    @action(detail=True, methods=["post"])
    def reject(self, request, **kwargs):
        obj = self.get_object()
        
        message = request.data.get("message", request.data.get("reason", ""))
        service = ApprovalService(request.user)
        service.reject(obj, message=message)
        
        response_data = {"status": "rejected"}
        if getattr(obj.__class__, "__name__", "") == "JobReport":
            response_data["report_status"] = obj.report_status
            
        return Response(response_data)
