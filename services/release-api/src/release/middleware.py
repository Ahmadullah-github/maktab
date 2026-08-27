from django.conf import settings
from django.http import JsonResponse


class RequestSizeLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/v1/") and request.method in {"POST", "PUT", "PATCH"}:
            raw_length = request.META.get("CONTENT_LENGTH", "")
            if not raw_length:
                return JsonResponse(
                    {
                        "error": {
                            "code": "CONTENT_LENGTH_REQUIRED",
                            "message": "Content-Length is required.",
                        }
                    },
                    status=411,
                )
            try:
                content_length = int(raw_length or 0)
            except ValueError:
                content_length = settings.DATA_UPLOAD_MAX_MEMORY_SIZE + 1
            if content_length > settings.DATA_UPLOAD_MAX_MEMORY_SIZE:
                return JsonResponse(
                    {
                        "error": {
                            "code": "REQUEST_TOO_LARGE",
                            "message": "Request body is too large.",
                        }
                    },
                    status=413,
                )
            if request.content_type and request.content_type.split(";", 1)[0] != "application/json":
                return JsonResponse(
                    {"error": {"code": "UNSUPPORTED_MEDIA_TYPE", "message": "JSON is required."}},
                    status=415,
                )
        return self.get_response(request)
