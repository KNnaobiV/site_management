from uuid import uuid4


def generate_code(value=None):
    """Generate a unique invitation code using UUID4."""
    return uuid4().hex