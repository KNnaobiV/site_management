from .base import BASE_DIR, CFG

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'your_database_name',
        'USER': 'your_mysql_username',
        'PASSWORD': 'your_mysql_password',
        'HOST': 'localhost',  # Or your DB host address
        'PORT': '3306',       # Default MySQL port
    }
}


ADMIN_URL = CFG.get("SITE", "DJANGO_ADMIN_URL")

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

ALLOWED_HOSTS = ["localhost", "0.0.0.0", "127.0.0.1"]

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