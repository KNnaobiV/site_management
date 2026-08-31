import ast
from .base import BASE_DIR, CFG

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': CFG.get("DATABASE", "POSTGRES_DB"),
        'USER': CFG.get("DATABASE", "POSTGRES_USER"),
        'PASSWORD': CFG.get("DATABASE", "POSTGRES_PASSWORD"),
        'HOST': CFG.get("DATABASE","POSTGRES_HOST"),  # Or your DB host address
        'PORT': CFG.get("DATABASE", "POSTGRES_PORT"),       # Default MySQL port
    }
}


ADMIN_URL = CFG.get("SITE", "DJANGO_ADMIN_URL")
ALLOWED_HOSTS = ast.literal_eval(CFG.get(
    'SITE',
    'ALLOWED_HOSTS',
    fallback="['127.0.0.1:8000']"
))
CORS_ALLOWED_ORIGINS = ast.literal_eval(CFG.get(
    'SITE',
    'CORS_ALLOWED_ORIGINS',
    fallback="['http://localhost:8000', 'http://localhost:5173']"
))

CSRF_TRUSTED_ORIGINS = ast.literal_eval(CFG.get(
    'SITE',
    'CSRF_TRUSTED_ORIGINS', 
    fallback="['http://localhost:8000', 'http://localhost:5173']"
))
FRONTEND_URL = CFG.get("SITE", "FRONTEND_URL", fallback="http://localhost:5173")
SECRET_KEY = CFG.get("SITE", "DJANGO_SECRET_KEY")
SITE_NAME = CFG.get("SITE", "SITE_NAME", fallback="http://localhost:8000")

EMAIL_BACKEND = CFG.get(
    'EMAIL',
    'EMAIL_BACKEND', 
    fallback='django.core.mail.backends.console.EmailBackend'
)
DEFAULT_FROM_EMAIL = CFG.get(
    'EMAIL',
    'DEFAULT_FROM_EMAIL', 
    fallback='no-reply@constropal.local'
)
EMAIL_HOST = CFG.get('EMAIL', 'EMAIL_HOST', fallback='')
EMAIL_PORT = CFG.getint('EMAIL', 'EMAIL_PORT', fallback=None)
EMAIL_USE_SSL = CFG.getboolean('EMAIL', 'EMAIL_USE_SSL', fallback=True)
EMAIL_USE_TLS = CFG.getboolean('EMAIL', 'EMAIL_USE_TLS', fallback=False)
EMAIL_HOST_USER = CFG.get('EMAIL', 'EMAIL_HOST_USER', fallback='')
EMAIL_HOST_PASSWORD = CFG.get('EMAIL', 'EMAIL_HOST_PASSWORD', fallback='')


EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(levelname)s %(name)-12s %(asctime)s %(module)s %(process)d %(thread)d %(message)s"
        }
    },
    "handlers": {
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'django.log',
            'maxBytes': 1024 * 1024 * 5,  # 5MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    "root": {"level": "INFO", "handlers": ["console", "file"]},
}