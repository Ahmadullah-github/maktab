import json
import re
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from .models import DesktopRelease, LicenseAuditEvent

OWNER = "Ahmadullah-github"
REPOSITORY = "maktab"
HEX64 = re.compile(r"^[a-f0-9]{64}$")
SHA512 = re.compile(r"^[A-Za-z0-9+/]{86}==$")
VERSION = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
BUILD_ID = re.compile(r"^[0-9A-Za-z.-]{8,128}$")


def _exact(value, keys: set[str]) -> bool:
    return isinstance(value, dict) and set(value) == keys


def _github_release_url(value: str, version: str, filename: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.netloc == "github.com"
        and not parsed.params
        and not parsed.query
        and not parsed.fragment
        and parsed.path == f"/{OWNER}/{REPOSITORY}/releases/download/v{version}/{filename}"
    )


def load_release_descriptor(file_path: str) -> dict:
    path = Path(file_path)
    if not path.is_file() or path.stat().st_size > 1024 * 1024:
        raise ValidationError("Release descriptor is missing or too large")
    try:
        descriptor = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError("Release descriptor is invalid JSON") from exc
    if not _exact(
        descriptor,
        {
            "schema_version",
            "channel",
            "version",
            "build_id",
            "published_at",
            "minimum_supported_version",
            "release_notes",
            "release_config_sha256",
            "updater_metadata",
            "artifact",
        },
    ):
        raise ValidationError("Release descriptor has an invalid shape")
    metadata = descriptor.get("updater_metadata")
    artifact = descriptor.get("artifact")
    if not _exact(metadata, {"url", "sha256"}) or not _exact(
        artifact,
        {"filename", "url", "size", "sha256", "sha512", "authenticode_publisher"},
    ):
        raise ValidationError("Release descriptor assets have an invalid shape")
    version = descriptor.get("version")
    channel = descriptor.get("channel")
    expected_metadata = "latest.yml" if channel == "stable" else "pilot.yml"
    expected_artifact = f"Maktab-Timetable-{version}-x64.exe"
    published_at = parse_datetime(descriptor.get("published_at", ""))
    if (
        descriptor.get("schema_version") != 1
        or channel not in {"pilot", "stable"}
        or not isinstance(version, str)
        or not VERSION.fullmatch(version)
        or not isinstance(descriptor.get("minimum_supported_version"), str)
        or not VERSION.fullmatch(descriptor["minimum_supported_version"])
        or not isinstance(descriptor.get("build_id"), str)
        or not BUILD_ID.fullmatch(descriptor["build_id"])
        or not isinstance(descriptor.get("release_notes"), str)
        or len(descriptor["release_notes"].encode()) > 16_384
        or published_at is None
        or published_at.tzinfo is None
        or not isinstance(descriptor.get("release_config_sha256"), str)
        or not HEX64.fullmatch(descriptor["release_config_sha256"])
        or metadata.get("sha256") is None
        or not HEX64.fullmatch(metadata["sha256"])
        or artifact.get("filename") != expected_artifact
        or not isinstance(artifact.get("size"), int)
        or not 1 <= artifact["size"] <= 2 * 1024 * 1024 * 1024
        or not isinstance(artifact.get("sha256"), str)
        or not HEX64.fullmatch(artifact["sha256"])
        or not isinstance(artifact.get("sha512"), str)
        or not SHA512.fullmatch(artifact["sha512"])
        or not isinstance(artifact.get("authenticode_publisher"), str)
        or not 1 <= len(artifact["authenticode_publisher"]) <= 256
        or not _github_release_url(metadata.get("url", ""), version, expected_metadata)
        or not _github_release_url(artifact.get("url", ""), version, expected_artifact)
    ):
        raise ValidationError("Release descriptor values are invalid")
    descriptor["published_at"] = published_at
    return descriptor


@transaction.atomic
def register_release(descriptor: dict, *, actor: str, reason: str) -> DesktopRelease:
    if DesktopRelease.objects.filter(
        channel=descriptor["channel"], version=descriptor["version"]
    ).exists():
        raise ValidationError("This channel and version is already registered")
    release = DesktopRelease.objects.create(
        channel=descriptor["channel"],
        version=descriptor["version"],
        build_id=descriptor["build_id"],
        published_at=descriptor["published_at"],
        minimum_supported_version=descriptor["minimum_supported_version"],
        rollout_percent=0,
        release_notes=descriptor["release_notes"],
        updater_metadata_url=descriptor["updater_metadata"]["url"],
        updater_metadata_sha256=descriptor["updater_metadata"]["sha256"],
        artifact_filename=descriptor["artifact"]["filename"],
        artifact_url=descriptor["artifact"]["url"],
        artifact_size=descriptor["artifact"]["size"],
        artifact_sha256=descriptor["artifact"]["sha256"],
        artifact_sha512=descriptor["artifact"]["sha512"],
        authenticode_publisher=descriptor["artifact"]["authenticode_publisher"],
        release_config_sha256=descriptor["release_config_sha256"],
        enabled=False,
    )
    LicenseAuditEvent.objects.create(
        action="desktop_release_register",
        outcome="success",
        actor=actor,
        reason=reason,
        metadata={
            "build_id": release.build_id,
            "version": release.version,
            "channel": release.channel,
        },
    )
    return release


@transaction.atomic
def set_release_state(
    build_id: str, *, rollout_percent: int | None, enabled: bool | None, actor: str, reason: str
) -> DesktopRelease:
    release = DesktopRelease.objects.select_for_update().filter(build_id=build_id).first()
    if not release:
        raise ValidationError("Desktop release was not found")
    fields = []
    if rollout_percent is not None:
        if not 0 <= rollout_percent <= 100:
            raise ValidationError("Rollout percent must be between 0 and 100")
        release.rollout_percent = rollout_percent
        fields.append("rollout_percent")
    if enabled is not None:
        release.enabled = enabled
        fields.append("enabled")
    release.save(update_fields=fields)
    action = "desktop_release_disable" if enabled is False else "desktop_release_update"
    LicenseAuditEvent.objects.create(
        action=action,
        outcome="success",
        actor=actor,
        reason=reason,
        metadata={
            "build_id": release.build_id,
            "rollout_percent": release.rollout_percent,
            "enabled": release.enabled,
        },
    )
    return release
