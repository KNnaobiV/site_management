from django.contrib.auth.models import get_user_model, Group

from core.models import ConstructionProject

User = get_user_model()

def invite_user_to_project(email, project_id):
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        raise ValueError(f"User with email {email} does not exist.")
    
    try:
        project = ConstructionProject.objects.get(id=project_id)
    except ConstructionProject.DoesNotExist:
        raise ValueError(f"Project with id {project_id} does not exist.")
    
    # Here you would add logic to associate the user with the project,
    # such as adding them to a group or creating a membership record.
    # For example:
    # project.members.add(user)
    # project.
    
    return f"User {email} has been invited to project {project.name}."