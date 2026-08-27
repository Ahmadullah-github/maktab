import hashlib
import secrets
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView, exception_handler

from .idempotency import run_idempotent
from .models import Activation, DesktopRelease, License
from .security import DatabaseRateThrottle, audit, request_id, signal
from .signing import sign_lease, sign_manifest

hasher = PasswordHasher()


def api_exception_handler(exc, context):
    if isinstance(exc, Throttled):
        response = Response(
            {
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Try again later.",
                    "retryable": True,
                }
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
        if exc.wait:
            response["Retry-After"] = str(max(1, int(exc.wait)))
        return response
    return exception_handler(exc, context)


def error(code: str, message: str, http_status: int, *, retryable: bool = False) -> Response:
    return Response(
        {"error": {"code": code, "message": message, "retryable": retryable}},
        status=http_status,
    )


def strict_object(value, allowed: set[str]) -> bool:
    return isinstance(value, dict) and set(value).issubset(allowed)


def bounded_string(value, minimum: int, maximum: int) -> bool:
    return isinstance(value, str) and minimum <= len(value.encode("utf-8")) <= maximum


def canonical_uuid(value) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return str(uuid.UUID(value)) == value.lower()
    except ValueError:
        return False


def valid_common(data, allowed: set[str]) -> bool:
    return (
        strict_object(data, allowed)
        and data.get("schema_version") == 1
        and bounded_string(data.get("idempotency_key"), 8, 128)
    )


def response_for(activation: Activation, refresh_token: str) -> Response:
    lease = sign_lease(
        activation=activation,
        device_id=activation.device_id,
        channel=activation.license.channel,
    )
    return Response(
        {
            "activation_id": str(activation.pk),
            "refresh_token": refresh_token,
            "lease": lease,
            "server_time": timezone.now().isoformat(),
        }
    )


def lifecycle_error(license: License) -> Response | None:
    if license.revoked_at is not None:
        return error("LICENSE_REVOKED", "License has been revoked.", status.HTTP_403_FORBIDDEN)
    if not license.enabled:
        return error("LICENSE_DISABLED", "License is disabled.", status.HTTP_403_FORBIDDEN)
    if license.expires_at is not None and license.expires_at <= timezone.now():
        return error("LICENSE_EXPIRED", "License has expired.", status.HTTP_403_FORBIDDEN)
    return None


class PublicReleaseView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [DatabaseRateThrottle]
    rate_limit_scope = None

    def initial(self, request, *args, **kwargs):
        request.release_request_id = request_id(request)
        super().initial(request, *args, **kwargs)


class ActivateView(PublicReleaseView):
    rate_limit_scope = "activate"

    def post(self, request):
        data = request.data
        if not valid_common(
            data, {"schema_version", "license_key", "product", "device", "app", "idempotency_key"}
        ):
            return error(
                "INVALID_REQUEST", "Activation request is invalid.", status.HTTP_400_BAD_REQUEST
            )
        if (
            data.get("product") != "desktop-timetable"
            or not bounded_string(data.get("license_key"), 16, 256)
            or not strict_object(data.get("device"), {"id", "support_code", "platform", "arch"})
            or not strict_object(data.get("app"), {"version", "build_id", "channel"})
        ):
            return error(
                "INVALID_REQUEST", "Activation request is invalid.", status.HTTP_400_BAD_REQUEST
            )
        device = data["device"]
        app = data["app"]
        if (
            not bounded_string(device.get("id"), 16, 128)
            or not bounded_string(device.get("support_code"), 12, 32)
            or device.get("platform") not in {"win32"}
            or device.get("arch") not in {"x64"}
            or not bounded_string(app.get("version"), 1, 32)
            or not bounded_string(app.get("build_id"), 1, 128)
            or app.get("channel") not in {"pilot", "stable"}
        ):
            return error(
                "INVALID_DEVICE",
                "Device or application identity is invalid.",
                status.HTTP_400_BAD_REQUEST,
            )

        return run_idempotent(
            scope="activate", data=data, callback=lambda: self._activate(request, data)
        )

    def _activate(self, request, data):
        key = data["license_key"].strip()
        device = data["device"]
        try:
            license = License.objects.select_for_update().get(
                lookup_digest=hashlib.sha256(key.encode()).hexdigest(),
                product="desktop-timetable",
            )
            hasher.verify(license.key_hash, key)
        except (License.DoesNotExist, VerifyMismatchError, InvalidHashError):
            signal(request, category="invalid_license", error_code="INVALID_LICENSE_KEY")
            audit(
                request,
                action="activation",
                outcome="denied",
                error_code="INVALID_LICENSE_KEY",
                device_id=device["id"],
            )
            return error(
                "INVALID_LICENSE_KEY", "License key is invalid.", status.HTTP_403_FORBIDDEN
            )

        denied = lifecycle_error(license)
        if denied:
            code = denied.data["error"]["code"]
            audit(
                request,
                action="activation",
                outcome="denied",
                license=license,
                error_code=code,
                device_id=device["id"],
            )
            return denied

        active = Activation.objects.select_for_update().filter(license=license, active=True).first()
        if active and active.device_id != device["id"]:
            signal(request, category="device_limit", error_code="DEVICE_LIMIT")
            audit(
                request,
                action="activation",
                outcome="denied",
                license=license,
                activation=active,
                error_code="DEVICE_LIMIT",
                device_id=device["id"],
            )
            return error(
                "DEVICE_LIMIT",
                "Deactivate the existing device or request an owner reset.",
                status.HTTP_409_CONFLICT,
            )

        token = secrets.token_urlsafe(48)
        activation = active or Activation(
            license=license,
            device_id=device["id"],
            support_code=device["support_code"],
        )
        activation.support_code = device["support_code"]
        activation.refresh_hash = hasher.hash(token)
        activation.active = True
        activation.deactivated_at = None
        activation.deactivation_reason = ""
        activation.save()
        audit(
            request,
            action="activation",
            outcome="success",
            license=license,
            activation=activation,
            device_id=device["id"],
            metadata={"app_version": data["app"]["version"], "channel": data["app"]["channel"]},
        )
        return response_for(activation, token)


class RefreshView(PublicReleaseView):
    rate_limit_scope = "refresh"

    def post(self, request):
        data = request.data
        if not valid_common(
            data,
            {
                "schema_version",
                "activation_id",
                "refresh_token",
                "device_id",
                "current_lease_id",
                "app_version",
                "build_id",
                "idempotency_key",
            },
        ) or not all(
            [
                bounded_string(data.get("activation_id"), 1, 32),
                bounded_string(data.get("refresh_token"), 32, 512),
                bounded_string(data.get("device_id"), 16, 128),
                canonical_uuid(data.get("current_lease_id")),
                bounded_string(data.get("app_version"), 1, 32),
                bounded_string(data.get("build_id"), 1, 128),
            ]
        ):
            return error(
                "INVALID_REQUEST", "Refresh request is invalid.", status.HTTP_400_BAD_REQUEST
            )
        return run_idempotent(
            scope="refresh", data=data, callback=lambda: self._refresh(request, data)
        )

    def _refresh(self, request, data):
        try:
            activation = (
                Activation.objects.select_for_update()
                .select_related("license")
                .get(pk=data["activation_id"], active=True)
            )
        except (Activation.DoesNotExist, ValueError):
            signal(request, category="invalid_refresh", error_code="INVALID_REFRESH")
            return error(
                "INVALID_REFRESH", "Refresh credential is invalid.", status.HTTP_403_FORBIDDEN
            )

        license = activation.license
        if activation.device_id != data["device_id"]:
            signal(request, category="device_mismatch", error_code="DEVICE_MISMATCH")
            return error(
                "DEVICE_MISMATCH",
                "Activation belongs to another device.",
                status.HTTP_403_FORBIDDEN,
            )
        if activation.last_lease_id and str(activation.last_lease_id) != data["current_lease_id"]:
            signal(request, category="stale_lease", error_code="STALE_LEASE")
            return error("STALE_LEASE", "The supplied lease is stale.", status.HTTP_409_CONFLICT)
        try:
            hasher.verify(activation.refresh_hash, data["refresh_token"])
        except (VerifyMismatchError, InvalidHashError):
            signal(request, category="invalid_refresh", error_code="INVALID_REFRESH")
            audit(
                request,
                action="refresh",
                outcome="denied",
                license=license,
                activation=activation,
                error_code="INVALID_REFRESH",
                device_id=data["device_id"],
            )
            return error(
                "INVALID_REFRESH", "Refresh credential is invalid.", status.HTTP_403_FORBIDDEN
            )

        denied = lifecycle_error(license)
        if denied:
            code = denied.data["error"]["code"]
            activation.active = False
            activation.deactivated_at = timezone.now()
            activation.deactivation_reason = code.lower()
            activation.save(
                update_fields=["active", "deactivated_at", "deactivation_reason", "refreshed_at"]
            )
            audit(
                request,
                action="refresh",
                outcome="denied",
                license=license,
                activation=activation,
                error_code=code,
                device_id=data["device_id"],
            )
            return denied

        token = secrets.token_urlsafe(48)
        activation.refresh_hash = hasher.hash(token)
        activation.save(update_fields=["refresh_hash", "refreshed_at"])
        audit(
            request,
            action="refresh",
            outcome="success",
            license=license,
            activation=activation,
            device_id=data["device_id"],
            metadata={"app_version": data["app_version"], "build_id": data["build_id"]},
        )
        return response_for(activation, token)


class DeactivateView(PublicReleaseView):
    rate_limit_scope = "deactivate"

    def post(self, request):
        data = request.data
        if not valid_common(
            data,
            {"schema_version", "activation_id", "refresh_token", "device_id", "idempotency_key"},
        ) or not all(
            [
                bounded_string(data.get("activation_id"), 1, 32),
                bounded_string(data.get("refresh_token"), 32, 512),
                bounded_string(data.get("device_id"), 16, 128),
            ]
        ):
            return error(
                "INVALID_REQUEST", "Deactivation request is invalid.", status.HTTP_400_BAD_REQUEST
            )
        return run_idempotent(
            scope="deactivate", data=data, callback=lambda: self._deactivate(request, data)
        )

    def _deactivate(self, request, data):
        try:
            activation = (
                Activation.objects.select_for_update()
                .select_related("license")
                .get(pk=data["activation_id"])
            )
            hasher.verify(activation.refresh_hash, data["refresh_token"])
        except (Activation.DoesNotExist, VerifyMismatchError, InvalidHashError, ValueError):
            signal(request, category="invalid_refresh", error_code="INVALID_REFRESH")
            return error(
                "INVALID_REFRESH", "Refresh credential is invalid.", status.HTTP_403_FORBIDDEN
            )
        if activation.device_id != data["device_id"]:
            signal(request, category="device_mismatch", error_code="DEVICE_MISMATCH")
            return error(
                "DEVICE_MISMATCH",
                "Activation belongs to another device.",
                status.HTTP_403_FORBIDDEN,
            )
        if activation.active:
            activation.active = False
            activation.deactivated_at = timezone.now()
            activation.deactivation_reason = "device_deactivated"
            activation.save(
                update_fields=["active", "deactivated_at", "deactivation_reason", "refreshed_at"]
            )
        audit(
            request,
            action="deactivation",
            outcome="success",
            license=activation.license,
            activation=activation,
            device_id=data["device_id"],
        )
        return Response({"status": "deactivated"})


class ResetActivationView(APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, activation_id):
        activation = (
            Activation.objects.select_for_update()
            .select_related("license")
            .filter(pk=activation_id)
            .first()
        )
        if not activation:
            return error(
                "ACTIVATION_NOT_FOUND", "Activation was not found.", status.HTTP_404_NOT_FOUND
            )
        reason = (
            request.data.get("reason", "owner_reset")
            if isinstance(request.data, dict)
            else "owner_reset"
        )
        if not bounded_string(reason, 3, 256):
            return error(
                "INVALID_REQUEST", "A reset reason is required.", status.HTTP_400_BAD_REQUEST
            )
        activation.active = False
        activation.deactivated_at = timezone.now()
        activation.deactivation_reason = reason
        activation.save(
            update_fields=["active", "deactivated_at", "deactivation_reason", "refreshed_at"]
        )
        audit(
            request,
            action="owner_reset",
            outcome="success",
            license=activation.license,
            activation=activation,
            actor=str(request.user.pk),
            reason=reason,
        )
        return Response({"status": "reset"})


class LatestUpdateView(PublicReleaseView):
    throttle_classes = []

    def get(self, _request, channel):
        release = (
            DesktopRelease.objects.filter(channel=channel, enabled=True, rollout_percent__gt=0)
            .order_by("-published_at")
            .first()
        )
        if not release:
            return error("NO_RELEASE", "No release is available.", status.HTTP_404_NOT_FOUND)
        manifest = {
            "schema_version": 2,
            "channel": release.channel,
            "version": release.version,
            "build_id": release.build_id,
            "published_at": release.published_at.isoformat(),
            "minimum_supported_version": release.minimum_supported_version,
            "rollout_percent": release.rollout_percent,
            "release_notes": release.release_notes,
            "updater_metadata": {
                "url": release.updater_metadata_url,
                "sha256": release.updater_metadata_sha256,
            },
            "artifacts": [
                {
                    "filename": release.artifact_filename,
                    "url": release.artifact_url,
                    "size": release.artifact_size,
                    "sha256": release.artifact_sha256,
                    "sha512": release.artifact_sha512,
                    "authenticode_publisher": release.authenticode_publisher,
                }
            ],
        }
        return Response(sign_manifest(manifest))
