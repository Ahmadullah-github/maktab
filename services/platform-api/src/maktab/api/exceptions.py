from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, object]):
    response = exception_handler(exc, context)
    if response is None:
        return None

    details = response.data
    message = "Request failed"
    if isinstance(details, dict) and isinstance(details.get("detail"), str):
        message = details["detail"]
    response.data = {
        "error": {
            "status": response.status_code,
            "message": message,
            "details": details,
        }
    }
    return response
