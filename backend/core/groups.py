from django.contrib.auth.models import Group

# 
# internal_member = Group.objects.get_or_create(
#     "Internal Member"
# )
# external_member = Group.objects.get_or_create("External Member")
# foreman = Group.objects.get_or_create("Foreman")
# storekeeper = Group.objects.get_or_create("Storekeeper")
# project_manager = Group.objects.get_or_create("Project Manager")
# client = Group.objects.get_or_create("Client")
# consultant = Group.objects.get_or_create("Consultant")


def create_company_group(company_name):
    _, created = Group.objects.get_or_create(name=company_name)
    if not created:
        raise ValueError(f"Name: {company_name} already exists")
    return


def create_project_group(project_name, group_suffix=None):
    if group_suffix:
        group_name = f"{project_name} {group_suffix}"

    _, created = Group.objects.get_or_create(name=group_name)
    # if created:
    #     raise ValueError(f"Name: {group_name} already exists")
    return