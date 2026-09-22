import logging
import re
from django.core.exceptions import (
    PermissionDenied as DjangoPermissionDenied,
    ValidationError as DjangoValidationError,
)
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# Map raw database/serializer field keys to clean human-readable names
FIELD_LABEL_OVERRIDES = {
    "construction_project": "Project",
    "construction_project_id": "Project",
    "project": "Project",
    "project_id": "Project",
    "construction_plot": "Plot",
    "construction_plot_id": "Plot",
    "plot": "Plot",
    "plot_id": "Plot",
    "construction_site": "Construction Site",
    "construction_site_id": "Construction Site",
    "site": "Construction Site",
    "work_item": "Work Item",
    "work_item_id": "Work Item",
    "job_item": "Job Item",
    "job_item_id": "Job Item",
    "job_name": "Job Name",
    "job_artisan": "Artisan",
    "job_description": "Job Description",
    "job_status": "Job Status",
    "plot_number": "Plot Number",
    "start_date": "Start Date",
    "target_end_date": "Target End Date",
    "proposed_start_date": "Proposed Start Date",
    "proposed_end_date": "Proposed End Date",
    "actual_start_date": "Actual Start Date",
    "actual_end_date": "Actual End Date",
    "site_opening_date": "Opening Date",
    "plot_opening_date": "Opening Date",
    "project_name": "Project Name",
    "project_description": "Project Description",
    "project_status": "Project Status",
    "allocated_amount": "Allocated Budget",
    "spent_amount": "Spent Amount",
    "budget_amount": "Budget Amount",
    "budget_currency": "Currency",
    "currency": "Currency",
    "amount": "Amount",
    "gps_latitude": "GPS Latitude",
    "gps_longitude": "GPS Longitude",
    "foreman": "Foreman",
    "foreman_id": "Foreman",
    "storekeeper": "Storekeeper",
    "storekeeper_id": "Storekeeper",
    "client": "Client",
    "client_id": "Client",
    "project_manager": "Project Manager",
    "project_manager_id": "Project Manager",
    "consultants": "Consultants",
    "invitee": "Team Member",
    "invitee_id": "Team Member",
    "invited_by": "Invited By",
    "user_id": "User",
    "login": "Email or Username",
    "username": "Username",
    "email": "Email Address",
    "password": "Password",
    "password1": "Password",
    "password2": "Confirm Password",
    "confirm_password": "Confirm Password",
    "old_password": "Current Password",
    "new_password": "New Password",
    "first_name": "First Name",
    "last_name": "Last Name",
    "display_name": "Display Name",
    "unit_of_measure": "Unit of Measure",
    "unit_of_measurement": "Unit of Measurement",
    "material_name": "Material Name",
    "projected_quantity": "Projected Quantity",
    "actual_quantity": "Actual Quantity",
    "needed_by": "Needed By",
    "report_date": "Report Date",
    "priority": "Priority",
    "weather": "Weather Conditions",
    "summary": "Summary",
    "work_done": "Work Done",
    "challenges": "Challenges",
    "plan_for_tomorrow": "Plan for Tomorrow",
    "percentage_job_progress": "Job Progress Percentage",
    "expected_completion_date": "Expected Completion Date",
    "issues_encountered": "Issues Encountered",
    "internal_comments": "Internal Comments",
    "external_comments": "External Comments",
    "cost_code": "Cost Code",
    "cost_code_id": "Cost Code",
    "incurred_at": "Expense Date",
    "profile_picture": "Profile Picture",
    "cover_image": "Cover Image",
    "cover_image_id": "Cover Image",
    "work_item_image": "Work Item Image",
    "job_image": "Report Image",
    "job_video": "Report Video",
    "file": "Document File",
    "notes": "General Observation",
    "address": "Address",
    "status": "Status",
    "role": "Role",
    "number_of_plots": "Number of Plots",
    "estimated_hours": "Estimated Hours",
}


def humanize_field_name(field_name: str) -> str:
    """Convert a technical snake_case field key to a readable label."""
    if not field_name:
        return ""
    if field_name in FIELD_LABEL_OVERRIDES:
        return FIELD_LABEL_OVERRIDES[field_name]
    
    clean = field_name
    if clean.endswith("_id") and len(clean) > 3:
        clean = clean[:-3]
    return clean.replace("_", " ").title()


def humanize_error_message(field_name: str, raw_message, code: str = None) -> str:
    """
    Transforms raw DRF/Django validation messages into natural, human-readable English sentences.
    """
    msg_str = str(raw_message).strip()
    is_non_field = field_name in ("non_field_errors", "detail", "__all__", None, "")

    if is_non_field:
        # Common submission / auth errors
        if "Unable to log in with provided credentials" in msg_str:
            return "Invalid email/username or password. Please try again."
        if "No active account found" in msg_str:
            return "No active account found with these credentials."
        if "User account is disabled" in msg_str:
            return "Your account has been deactivated. Please contact an administrator."
        if "Authentication credentials were not provided" in msg_str:
            return "Please sign in to continue."
        if "You do not have permission to perform this action" in msg_str:
            return "You do not have permission to perform this action."
        if "Not found" in msg_str:
            return "The requested resource was not found."
        if "Passwords do not match" in msg_str:
            return "The passwords entered do not match."
        if "This password is too short" in msg_str:
            return "Password is too short. It must contain at least 8 characters."
        if "This password is too common" in msg_str:
            return "This password is too common. Please choose a stronger password."
        if "This password is entirely numeric" in msg_str:
            return "Password cannot consist only of numbers."
        return msg_str

    label = humanize_field_name(field_name)

    # 1. Required fields
    if code == "required" or msg_str == "This field is required.":
        return f"{label} is required."

    # 2. Blank / Empty fields
    if code == "blank" or msg_str == "This field may not be blank.":
        return f"{label} cannot be blank."
    if code == "null" or msg_str == "This field may not be null.":
        return f"{label} cannot be empty."
    if code == "empty" or "may not be empty" in msg_str:
        return f"{label} cannot be empty."

    # 3. Invalid choices
    if code == "invalid_choice" or "is not a valid choice" in msg_str:
        m = re.search(r'["\'](.*?)["\']\s+is not a valid choice', msg_str)
        if m:
            val = m.group(1)
            return f"'{val}' is not a valid choice for {label}."
        return f"The selected value is not valid for {label}."

    # 4. Related object / Foreign key
    if code == "does_not_exist" or "does not exist" in msg_str or "Invalid pk" in msg_str:
        return f"The selected {label} does not exist."

    # 5. Unique constraints
    if code == "unique" or "already exists" in msg_str:
        return f"A record with this {label} already exists."

    # 6. Dates and times
    if code == "date" or "Date has wrong format" in msg_str:
        return f"{label} must be a valid date in YYYY-MM-DD format."
    if code == "datetime" or "Datetime has wrong format" in msg_str:
        return f"{label} must be a valid date and time in YYYY-MM-DD HH:MM format."

    # 7. Numbers and Integers
    if "valid integer is required" in msg_str:
        return f"{label} must be a valid whole number."
    if "valid number is required" in msg_str:
        return f"{label} must be a valid number."

    # 8. Email & URL
    if code == "email" or "valid email address" in msg_str:
        return f"Please enter a valid email address for {label}."
    if code == "url" or "valid URL" in msg_str:
        return f"Please enter a valid web URL for {label}."

    # 9. Files & Images
    if "Upload a valid image" in msg_str:
        return f"Please upload a valid image file (such as JPG or PNG) for {label}."

    # 10. Length limits
    if "characters" in msg_str and "at least" in msg_str:
        m = re.search(r"at least (\d+)", msg_str)
        n = m.group(1) if m else "8"
        return f"{label} must have at least {n} characters."
    if "characters" in msg_str and "at most" in msg_str:
        m = re.search(r"at most (\d+)", msg_str)
        n = m.group(1) if m else "100"
        return f"{label} cannot exceed {n} characters."

    # 11. Numeric value ranges
    if "greater than or equal to" in msg_str:
        m = re.search(r"greater than or equal to ([\d.]+)", msg_str)
        v = m.group(1) if m else "0"
        return f"{label} must be at least {v}."
    if "less than or equal to" in msg_str:
        m = re.search(r"less than or equal to ([\d.]+)", msg_str)
        v = m.group(1) if m else "100"
        return f"{label} cannot exceed {v}."

    # 12. Fallback
    if msg_str.startswith("This field"):
        return msg_str.replace("This field", label)

    return msg_str


def _format_error_item(field_name: str, item):
    """Recursively formats error items (strings, ErrorDetail, lists, dicts)."""
    if isinstance(item, (list, tuple)):
        return [_format_error_item(field_name, sub) for sub in item]
    if isinstance(item, dict):
        formatted = {}
        for sub_key, sub_val in item.items():
            formatted[sub_key] = _format_error_item(sub_key, sub_val)
        return formatted
    code = getattr(item, "code", None)
    return humanize_error_message(field_name, item, code=code)


def _collect_messages(data, messages_set: set, messages_list: list):
    """Flattens error messages into an ordered, deduplicated list of strings."""
    if isinstance(data, (list, tuple)):
        for item in data:
            _collect_messages(item, messages_set, messages_list)
    elif isinstance(data, dict):
        for key, val in data.items():
            _collect_messages(val, messages_set, messages_list)
    elif isinstance(data, str):
        msg = data.strip()
        if msg and msg not in messages_set:
            messages_set.add(msg)
            messages_list.append(msg)


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler that:
    1. Converts non-DRF exceptions (Django ValidationError, ValueError, IntegrityError)
       into clean, human-readable DRF errors.
    2. Ensures all error strings passed to the frontend are human-readable English.
    3. Guarantees top-level 'message' and 'detail' summary strings along with field-level errors.
    """
    # 1. Pre-process exceptions that DRF standard handler misses:
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            exc = exceptions.ValidationError(detail=exc.message_dict)
        elif hasattr(exc, "messages"):
            exc = exceptions.ValidationError(detail=exc.messages)
        else:
            exc = exceptions.ValidationError(detail=str(exc))

    elif isinstance(exc, ValueError):
        # Often raised by model.save() validations (e.g. date order checks)
        exc = exceptions.ValidationError(detail=str(exc))

    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied(detail="You do not have permission to perform this action.")

    elif isinstance(exc, Http404):
        exc = exceptions.NotFound(detail="The requested resource was not found.")

    elif isinstance(exc, IntegrityError):
        msg = str(exc)
        # Handle SQLite & Postgres unique constraints
        if "unique" in msg.lower() or "duplicate key" in msg.lower():
            if "plot_number" in msg.lower():
                readable = "A plot with this plot number already exists in this project."
            elif "project_name" in msg.lower():
                readable = "A project with this name already exists for your account."
            else:
                readable = "A record with this information already exists."
            return Response(
                {
                    "detail": readable,
                    "message": readable,
                    "non_field_errors": [readable],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        elif "not null" in msg.lower() or "cannot be null" in msg.lower():
            col = msg.split(".")[-1] if "." in msg else "field"
            col_clean = col.split()[0].strip('",\'`')
            readable = f"{humanize_field_name(col_clean)} cannot be empty."
            return Response(
                {
                    "detail": readable,
                    "message": readable,
                    "non_field_errors": [readable],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        elif "foreign key" in msg.lower():
            readable = "The referenced item does not exist or has been removed."
            return Response(
                {
                    "detail": readable,
                    "message": readable,
                    "non_field_errors": [readable],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        else:
            readable = "The operation could not be completed due to a database constraint."
            return Response(
                {
                    "detail": readable,
                    "message": readable,
                    "non_field_errors": [readable],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    # 2. Invoke default DRF handler
    response = drf_exception_handler(exc, context)

    # 3. If unhandled (e.g. 500 server crash)
    if response is None:
        logger.exception("Unhandled server exception in API: %s", exc, exc_info=exc)
        return Response(
            {
                "detail": "An unexpected server error occurred. Please try again later.",
                "message": "An unexpected server error occurred. Please try again later.",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # 4. Humanize error payload in response
    if isinstance(response.data, dict):
        formatted_dict = {}
        msg_set = set()
        msg_list = []

        for field_name, field_errors in response.data.items():
            formatted_item = _format_error_item(field_name, field_errors)
            formatted_dict[field_name] = formatted_item
            _collect_messages(formatted_item, msg_set, msg_list)

        summary = " ".join(msg_list) if msg_list else "Invalid submission."

        # Keep field errors at top level for backwards compatibility,
        # but also guarantee clear 'detail' and 'message' summaries
        response.data = {
            "detail": summary,
            "message": summary,
            **formatted_dict,
        }

    elif isinstance(response.data, (list, tuple)):
        formatted_list = [_format_error_item("non_field_errors", item) for item in response.data]
        msg_set = set()
        msg_list = []
        _collect_messages(formatted_list, msg_set, msg_list)
        summary = " ".join(msg_list) if msg_list else "Invalid submission."

        response.data = {
            "detail": summary,
            "message": summary,
            "non_field_errors": formatted_list,
        }

    return response
