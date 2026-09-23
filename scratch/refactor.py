import ast

file_path = "backend/core/views.py"
with open(file_path, "r", encoding="utf-8") as f:
    source = f.read()
    
tree = ast.parse(source)

to_remove = []

methods_to_remove = {
    "ConstructionProjectViewSet": ["export_reports", "export_financial_report"],
    "ConstructionPlotViewSet": ["export_reports", "export_financial_report"],
    "WorkItemViewSet": ["export_reports", "export_financial_report", "approve", "reject", "images", "delete_image", "_remove_image_from_work_item"],
    "JobItemViewSet": ["export_reports", "export_financial_report", "approve", "reject"],
    "JobReportViewSet": ["export_reports", "approve", "reject", "images", "delete_image", "_remove_image_from_report"],
}

classes_to_remove = {"ProjectScopedMixin", "PlotScopedMixin"}

for node in ast.iter_child_nodes(tree):
    if isinstance(node, ast.ClassDef):
        class_name = node.name
        if class_name in classes_to_remove:
            # We want to remove this whole class
            start_line = node.lineno
            if node.decorator_list:
                start_line = node.decorator_list[0].lineno
            end_line = node.end_lineno
            to_remove.append((start_line, end_line))
        elif class_name in methods_to_remove:
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    if item.name in methods_to_remove[class_name]:
                        start_line = item.lineno
                        if item.decorator_list:
                            start_line = item.decorator_list[0].lineno
                        end_line = item.end_lineno
                        to_remove.append((start_line, end_line))

# Sort descending so removals don't shift line numbers
to_remove.sort(key=lambda x: x[0], reverse=True)

lines = source.splitlines()
for start, end in to_remove:
    # Delete lines [start-1:end]
    del lines[start-1:end]

# Add new imports
new_imports = [
    "from core.mixins.scoped import ProjectScopedMixin, PlotScopedMixin",
    "from core.mixins.export import ExportMixin",
    "from core.mixins.approval import ApprovalMixin",
    "from core.mixins.images import ImageHandlingMixin"
]

new_source = "\n".join(lines)
for imp in new_imports:
    if imp not in new_source:
        new_source = imp + "\n" + new_source

# Now we need to update the base classes of these ViewSets
replacements = {
    "class ConstructionProjectViewSet(viewsets.ModelViewSet):": "class ConstructionProjectViewSet(ProjectScopedMixin, ExportMixin, viewsets.ModelViewSet):",
    "class ConstructionPlotViewSet(ProjectScopedMixin, viewsets.ModelViewSet):": "class ConstructionPlotViewSet(ProjectScopedMixin, ExportMixin, viewsets.ModelViewSet):",
    "class WorkItemViewSet(PlotScopedMixin, viewsets.ModelViewSet):": "class WorkItemViewSet(PlotScopedMixin, ExportMixin, ApprovalMixin, ImageHandlingMixin, viewsets.ModelViewSet):\n    cover_image_field = 'work_item_image'\n    def get_image_serializer_class(self):\n        from .serializers import WorkItemImageSerializer\n        return WorkItemImageSerializer\n",
    "class JobItemViewSet(PlotScopedMixin, viewsets.ModelViewSet):": "class JobItemViewSet(PlotScopedMixin, ExportMixin, ApprovalMixin, viewsets.ModelViewSet):",
    "class JobReportViewSet(PlotScopedMixin, viewsets.ModelViewSet):": "class JobReportViewSet(PlotScopedMixin, ExportMixin, ApprovalMixin, ImageHandlingMixin, viewsets.ModelViewSet):\n    cover_image_field = 'job_image'\n    def get_image_serializer_class(self):\n        from .serializers import JobReportImageSerializer\n        return JobReportImageSerializer\n",
}

for old, new in replacements.items():
    new_source = new_source.replace(old, new)

# Also update ConstructionProjectViewSet get_serializer_context
ctx_old = """    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # For retrieve/update/destroy, resolve role from the object
        if self.kwargs.get("pk"):
            try:
                project = ConstructionProject.objects.get(pk=self.kwargs["pk"])
                ctx["role"] = get_project_role(self.request.user, project)
            except ConstructionProject.DoesNotExist:
                ctx["role"] = "none"
        else:
            # list / create – owner since they're creating it
            ctx["role"] = "owner"
        return ctx"""

ctx_new = """    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action in ("list", "create"):
            ctx["role"] = "owner"
        return ctx"""

new_source = new_source.replace(ctx_old, ctx_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_source)

print("Refactored successfully")
