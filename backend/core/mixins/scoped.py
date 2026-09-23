from django.shortcuts import get_object_or_404
from core.models import ConstructionProject, ConstructionPlot, WorkItem, JobItem
from core.services.authorization import AuthorizationService
from core.selectors.scope import get_scope

class ScopedMixin:
    """
    Base mixin that uses AuthorizationService to inject 'role', 'project',
    and 'plot' into the serializer context.
    """
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
        
    def get_scope_object(self):
        """
        Return the object that defines the scope of this request.
        For detail views, this could be self.get_object().
        For list/create views, this could be the parent project or plot.
        """
        # Try to get the detail object if available and not list/create
        if self.detail and hasattr(self, "get_object"):
            try:
                return self.get_object()
            except Exception:
                pass
        return None


class ProjectScopedMixin(ScopedMixin):
    """
    Mixin for ViewSets that live under /projects/{project_pk}/.
    Resolves and caches the parent ConstructionProject.
    """
    _project_cache = None

    def get_project(self) -> ConstructionProject | None:
        if self._project_cache is None:
            project_pk = self.kwargs.get("project_pk")
            if project_pk:
                self._project_cache = get_object_or_404(
                    ConstructionProject, pk=project_pk
                )
        return self._project_cache

    def get_scope_object(self):
        obj = super().get_scope_object()
        if obj:
            return obj
        return self.get_project()


class PlotScopedMixin(ScopedMixin):
    """
    Mixin for ViewSets that live under /projects/{project_pk}/plots/{plot_pk}/.
    Resolves and caches the parent ConstructionPlot.
    """
    _plot_cache = None

    def get_plot(self) -> ConstructionPlot | None:
        if self._plot_cache is None:
            # 1. Try explicitly passed kwargs (nested routers)
            plot_pk = self.kwargs.get("plot_pk")
            if not plot_pk and self.__class__.__name__ == "ConstructionPlotViewSet":
                plot_pk = self.kwargs.get("pk")
                
            if plot_pk:
                self._plot_cache = ConstructionPlot.objects.filter(pk=plot_pk).first()
                if self._plot_cache:
                    return self._plot_cache

            # 2. Try falling back to parents of nested objects
            jobitem_pk = self.kwargs.get("jobitem_pk") or (
                self.kwargs.get("pk") if self.__class__.__name__ == "JobItemViewSet" else None
            )
            if jobitem_pk:
                ji = JobItem.objects.filter(pk=jobitem_pk).select_related(
                    "work_item__construction_plot"
                ).first()
                if ji and ji.work_item:
                    self._plot_cache = ji.work_item.construction_plot
                    return self._plot_cache

            workitem_pk = self.kwargs.get("workitem_pk") or (
                self.kwargs.get("pk") if self.__class__.__name__ == "WorkItemViewSet" else None
            )
            if workitem_pk:
                wi = WorkItem.objects.filter(pk=workitem_pk).select_related(
                    "construction_plot"
                ).first()
                if wi:
                    self._plot_cache = wi.construction_plot
                    return self._plot_cache
                    
            # 3. Fallback to request query_params or data (useful for list/create)
            query_params = getattr(self.request, "query_params", {}) if hasattr(self, "request") else {}
            request_data = getattr(self.request, "data", {}) if hasattr(self, "request") and isinstance(getattr(self.request, "data", None), dict) else {}
            
            plot_pk = (
                query_params.get("plot") or query_params.get("construction_plot") or
                request_data.get("plot") or request_data.get("construction_plot")
            )
            if plot_pk:
                self._plot_cache = ConstructionPlot.objects.filter(pk=plot_pk).first()
                
        return self._plot_cache

    def get_project(self) -> ConstructionProject | None:
        plot = self.get_plot()
        return plot.construction_project if plot else None

    def get_scope_object(self):
        obj = super().get_scope_object()
        if obj:
            return obj
        return self.get_plot()
