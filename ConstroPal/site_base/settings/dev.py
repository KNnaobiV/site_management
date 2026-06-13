import ast
from .base import BASE_DIR, CFG


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    },
    # 'postgres': {
    #     'ENGINE': 'django.db.backends.postgis',
    #     'NAME': 'apartments',
    #     'USER': 'admin_username',
    #     'PASSWORD': 'pwd',
    #     'HOST': 'localhost',
    #     'PORT': 'port_number'
    # }
}

FRONTEND_URL = CFG.get("SITE", "FRONTEND_URL", fallback="http://localhost:5173")
SITE_NAME = CFG.get("SITE", "SITE_NAME", fallback="http://localhost:8000")
ADMIN_URL = CFG.get("SITE", "DJANGO_ADMIN_URL")
SECRET_KEY = CFG.get("SITE", "DJANGO_SECRET_KEY")

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

GOOGLE_CLIENT_ID = CFG.get('GOOGLE', 'GOOGLE_CLIENT_ID', fallback='')
GOOGLE_CLIENT_SECRET = CFG.get('GOOGLE', 'GOOGLE_CLIENT_SECRET', fallback='')
APPLE_CLIENT_ID = CFG.get('APPLE', 'APPLE_CLIENT_ID', fallback='')

ALLOWED_HOSTS = ast.literal_eval(CFG.get(
    'SITE',
    'ALLOWED_HOSTS',
    fallback="['127.0.0.1:8000','https://constropal.alwaysdata.net']"
))

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


CORS_ALLOWED_ORIGINS = ast.literal_eval(CFG.get(
    'SITE',
    'CORS_ALLOWED_ORIGINS',
    fallback="['http://localhost:8000', 'http://localhost:5173', 'https://maccaferra.vercel.app']"
))

CSRF_TRUSTED_ORIGINS = ast.literal_eval(CFG.get(
    'SITE',
    'CSRF_TRUSTED_ORIGINS', 
    fallback="['http://localhost:8000', 'http://localhost:5173', 'https://maccaferra.vercel.app']"
))
