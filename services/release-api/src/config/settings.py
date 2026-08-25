import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
SECRET_KEY = os.environ.get("MAKTAB_RELEASE_DJANGO_SECRET", "development-only-release-api-secret")
DEBUG = os.environ.get("MAKTAB_RELEASE_DEBUG", "1") == "1"
ALLOWED_HOSTS = [
    host
    for host in os.environ.get("MAKTAB_RELEASE_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host
]
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "release",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "release.middleware.RequestSizeLimitMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("MAKTAB_RELEASE_DATABASE", BASE_DIR / "release.db"),
    }
}
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("MAKTAB_RELEASE_MAX_REQUEST_BYTES", "16384"))
IDEMPOTENCY_ENCRYPTION_KEY = os.environ.get("MAKTAB_IDEMPOTENCY_ENCRYPTION_KEY", SECRET_KEY)
LICENSE_LEASE_DAYS = int(os.environ.get("MAKTAB_LICENSE_LEASE_DAYS", "30"))
LICENSE_GRACE_DAYS = int(os.environ.get("MAKTAB_LICENSE_GRACE_DAYS", "7"))
RELEASE_RATE_LIMITS = {
    "activate": (
        int(os.environ.get("MAKTAB_ACTIVATE_RATE_COUNT", "10")),
        int(os.environ.get("MAKTAB_ACTIVATE_RATE_WINDOW", "900")),
    ),
    "refresh": (
        int(os.environ.get("MAKTAB_REFRESH_RATE_COUNT", "60")),
        int(os.environ.get("MAKTAB_REFRESH_RATE_WINDOW", "900")),
    ),
    "deactivate": (
        int(os.environ.get("MAKTAB_DEACTIVATE_RATE_COUNT", "20")),
        int(os.environ.get("MAKTAB_DEACTIVATE_RATE_WINDOW", "900")),
    ),
}
TRUST_RELEASE_PROXY_HEADERS = False
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "release.views.api_exception_handler",
}
