import os

views_file = r"c:\Users\Chike\Ekene\site_management\backend\core\views.py"
services_file = r"c:\Users\Chike\Ekene\site_management\backend\core\services.py"
serializers_file = r"c:\Users\Chike\Ekene\site_management\backend\core\serializers.py"

with open(views_file, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        "        if plot.foreman == user:\n            plot.foreman = None\n            plot.save()",
        "        if plot.foremen.filter(pk=user.pk).exists():\n            plot.foremen.remove(user)"
    ),
    (
        "            for p in project.constructionplot_set.all():\n                if p.foreman:\n                    members.add(p.foreman)\n                if hasattr(p, 'storekeeper') and getattr(p, 'storekeeper', None):\n                    members.add(p.storekeeper)",
        "            for p in project.constructionplot_set.all():\n                for f in p.foremen.all():\n                    members.add(f)"
    ),
    (
        "            for p in project.constructionplot_set.all():\n                if p.foreman:\n                    members.add(p.foreman)\n                if p.storekeeper:\n                    members.add(p.storekeeper)",
        "            for p in project.constructionplot_set.all():\n                for f in p.foremen.all():\n                    members.add(f)"
    ),
    (
        "        if plot.foreman:\n            Notification.objects.create(\n                user=plot.foreman,",
        "        for f in plot.foremen.all():\n            Notification.objects.create(\n                user=f,"
    ),
    (
        "        if getattr(plot, 'storekeeper', None):\n            Notification.objects.create(\n                user=plot.storekeeper,",
        ""
    ),
    (
        "        if getattr(plot, 'storekeeper', None):\n            Notification.objects.create(\n                user=plot.storekeeper,\n                project=project,\n                message=f\"Work item '{work_item.name}' approved\",\n                priority=Notification.Priority.NORMAL\n            )",
        ""
    ),
    (
        "        if hasattr(plot, 'storekeeper') and getattr(plot, 'storekeeper', None):\n            Notification.objects.create(\n                user=plot.storekeeper,",
        ""
    ),
    (
        "            if plot.foreman:\n                members.add(plot.foreman)\n            if getattr(plot, 'storekeeper', None):\n                members.add(plot.storekeeper)",
        "            for f in plot.foremen.all():\n                members.add(f)"
    ),
    (
        "        if plot.foreman:\n            members.add(plot.foreman)\n        if getattr(plot, 'storekeeper', None):\n            members.add(plot.storekeeper)",
        "        for f in plot.foremen.all():\n            members.add(f)"
    )
]

for target, replacement in replacements:
    content = content.replace(target, replacement)

with open(views_file, 'w', encoding='utf-8') as f:
    f.write(content)


with open(services_file, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "    if role == PlotRole.FOREMAN and plot.foreman == invitee:",
    "    if role == PlotRole.FOREMAN and plot.foremen.filter(pk=invitee.pk).exists():"
)

with open(services_file, 'w', encoding='utf-8') as f:
    f.write(content)


with open(serializers_file, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "            if plot.foreman:\n                user_dict[plot.foreman.id] = plot.foreman\n            if getattr(plot, 'storekeeper', None):\n                user_dict[plot.storekeeper.id] = plot.storekeeper",
    "            for f in plot.foremen.all():\n                user_dict[f.id] = f"
)

with open(serializers_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
