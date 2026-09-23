import ast

file_path = "backend/core/views.py"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip_decorators = [
    "@action(detail=True, methods=[\"get\"], url_path=\"export-reports\")",
    "@action(detail=True, methods=[\"get\"], url_path=\"export-financial-report\")",
    "@action(detail=True, methods=[\"post\", \"get\", \"delete\"], url_path=\"images\")",
    "@action(detail=True, methods=[\"delete\"], url_path=r\"images/(?P<image_id>[^/.]+)\")",
    "@action(detail=True, methods=[\"post\"])",
]

for line in lines:
    is_skip = False
    for dec in skip_decorators:
        if line.strip().startswith(dec):
            is_skip = True
            break
    if not is_skip:
        new_lines.append(line)

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
