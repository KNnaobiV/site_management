from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound
from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem
from core.services.authorization import AuthorizationService
from core.selectors.scope import get_scope

class ScopeResolutionMixin:
    """
    Unified mixin that extracts project/plot/work_item/job_item context from 
    request kwargs, query params, or the instance itself, and injects 'role', 
    'project', and 'plot' into the serializer context.
    """
    _scope_cache = None

    def get_scope_object(self):
        """
        Return the object that defines the scope of this request.
        For detail views, this is self.get_object().
        For list/create views, we try to infer it from kwargs or query_params.
        """
        if self._scope_cache is not None:
            return self._scope_cache

        # 1. Try explicitly passed kwargs for parent objects (nested routers)
        for kwarg, model in [
            ("jobitem_pk", JobItem),
            ("workitem_pk", WorkItem),
            ("plot_pk", ConstructionPlot),
            ("project_pk", ConstructionProject),
        ]:
            pk = self.kwargs.get(kwarg)
            if pk:
                self._scope_cache = model.objects.filter(pk=pk).first()
                if self._scope_cache:
                    return self._scope_cache

        # 2. Try the detail object if available using scope_model (avoids recursion)
        model = getattr(self, "scope_model", None)
        if getattr(self, "detail", False) and model:
            pk = self.kwargs.get(getattr(self, "lookup_url_kwarg", None) or getattr(self, "lookup_field", "pk"))
            if pk:
                self._scope_cache = model.objects.filter(pk=pk).first()
                if self._scope_cache:
                    return self._scope_cache

        # 3. Fallback to request query_params or data
        query_params = getattr(self.request, "query_params", {}) if hasattr(self, "request") else {}
        request_data = getattr(self.request, "data", {}) if hasattr(self, "request") and isinstance(getattr(self.request, "data", None), dict) else {}

        for param, model in [
            ("job_item", JobItem),
            ("work_item", WorkItem),
            ("construction_plot", ConstructionPlot),
            ("plot", ConstructionPlot),
            ("construction_project", ConstructionProject),
            ("project", ConstructionProject),
        ]:
            pk = query_params.get(param) or request_data.get(param)
            if pk:
                self._scope_cache = model.objects.filter(pk=pk).first()
                if self._scope_cache:
                    return self._scope_cache

        return None

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        obj = self.get_scope_object()
        
        if obj:
            auth = AuthorizationService(self.request.user)
            ctx["role"] = auth.role_for(obj)
            
            scope = get_scope(obj)
            ctx["project"] = scope.project
            ctx["plot"] = scope.plot
        else:
            ctx["role"] = "none"
            ctx["project"] = None
            ctx["plot"] = None
            
        return ctx

    def get_project(self):
        obj = self.get_scope_object()
        return get_scope(obj).project

    def get_plot(self):
        obj = self.get_scope_object()
        return get_scope(obj).plot
