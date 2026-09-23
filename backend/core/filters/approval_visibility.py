from django.db.models import Q


def visible_to_user(queryset, user, *, role, approval_field="is_approved",
                    creator_field="created_by"):
    if role in {"owner", "project_manager"}:
        return queryset

    return queryset.filter(
        Q(**{approval_field: True}) |
        Q(**{creator_field: user})
    )


def approved_only(queryset, *, approval_field="is_approved"):
    return queryset.filter(**{approval_field: True})
