from django.contrib.auth.models import Group


internal_member, is_created = Group.objects.get_or_create(
    "Internal Member"
)
external_member = Group.objects.get_or_create("External Member")
foreman = Group.objects.get_or_create("Foreman")
storekeeper = Group.objects.get_or_create("Storekeeper")
project_manager = Group.objects.get_or_create("Project Manager")
client = Group.objects.get_or_create("Client")
