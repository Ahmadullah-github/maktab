from django.db import models


class License(models.Model):
    lookup_digest = models.CharField(max_length=64, unique=True)
    key_hash = models.TextField()
    owner_reference = models.CharField(max_length=128, blank=True)
    product = models.CharField(max_length=64, default="desktop-timetable")
    channel = models.CharField(
        max_length=16, choices=[("pilot", "Pilot"), ("stable", "Stable")], default="pilot"
    )
    enabled = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"License {self.pk or 'unsaved'} ({self.product})"

    @property
    def is_issuable(self) -> bool:
        from django.utils import timezone

        return (
            self.enabled
            and self.revoked_at is None
            and (self.expires_at is None or self.expires_at > timezone.now())
        )


class Activation(models.Model):
    license = models.ForeignKey(License, on_delete=models.PROTECT, related_name="activations")
    device_id = models.CharField(max_length=128)
    support_code = models.CharField(max_length=32)
    refresh_hash = models.TextField()
    active = models.BooleanField(default=True)
    last_lease_id = models.UUIDField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    refreshed_at = models.DateTimeField(auto_now=True)
    deactivated_at = models.DateTimeField(null=True)
    deactivation_reason = models.CharField(max_length=256, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["license"],
                condition=models.Q(active=True),
                name="one_active_device_per_license",
            )
        ]

    def __str__(self) -> str:
        return f"Activation {self.pk or 'unsaved'}"


class IdempotencyRecord(models.Model):
    scope = models.CharField(max_length=32)
    key = models.CharField(max_length=128)
    request_digest = models.CharField(max_length=64)
    state = models.CharField(
        max_length=16,
        choices=[("pending", "Pending"), ("complete", "Complete")],
        default="pending",
    )
    response_ciphertext = models.BinaryField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["scope", "key"], name="unique_idempotency_scope_key")
        ]

    def __str__(self) -> str:
        return f"{self.scope}:{self.key}"


class LicenseAuditEvent(models.Model):
    action = models.CharField(max_length=64)
    outcome = models.CharField(
        max_length=16, choices=[("success", "Success"), ("denied", "Denied")]
    )
    license = models.ForeignKey(License, on_delete=models.PROTECT, null=True, blank=True)
    activation = models.ForeignKey(Activation, on_delete=models.PROTECT, null=True, blank=True)
    actor = models.CharField(max_length=128, blank=True)
    reason = models.CharField(max_length=256, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    network_fingerprint = models.CharField(max_length=64, blank=True)
    device_fingerprint = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["action", "created_at"], name="license_audit_action_time")]

    def __str__(self) -> str:
        return f"{self.action}:{self.outcome}"


class SecuritySignal(models.Model):
    category = models.CharField(max_length=64)
    fingerprint = models.CharField(max_length=64)
    severity = models.CharField(
        max_length=16,
        choices=[("info", "Info"), ("warning", "Warning"), ("critical", "Critical")],
    )
    count = models.PositiveIntegerField(default=1)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    last_error_code = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["category", "fingerprint"], name="unique_security_signal"
            )
        ]

    def __str__(self) -> str:
        return f"{self.category}:{self.severity}"


class RateLimitBucket(models.Model):
    scope = models.CharField(max_length=32)
    fingerprint = models.CharField(max_length=64)
    window_start = models.DateTimeField()
    request_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scope", "fingerprint", "window_start"], name="unique_rate_limit_bucket"
            )
        ]

    def __str__(self) -> str:
        return f"{self.scope}:{self.window_start.isoformat()}"


class DesktopRelease(models.Model):
    channel = models.CharField(max_length=16, choices=[("pilot", "Pilot"), ("stable", "Stable")])
    version = models.CharField(max_length=32)
    build_id = models.CharField(max_length=128, unique=True)
    published_at = models.DateTimeField()
    minimum_supported_version = models.CharField(max_length=32)
    rollout_percent = models.PositiveSmallIntegerField(default=0)
    release_notes = models.TextField(blank=True)
    updater_metadata_url = models.URLField()
    updater_metadata_sha256 = models.CharField(max_length=64)
    artifact_filename = models.CharField(max_length=160)
    artifact_url = models.URLField()
    artifact_size = models.PositiveBigIntegerField()
    artifact_sha256 = models.CharField(max_length=64)
    artifact_sha512 = models.CharField(max_length=128)
    authenticode_publisher = models.CharField(max_length=256)
    release_config_sha256 = models.CharField(max_length=64)
    enabled = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["channel", "version"], name="unique_release_channel_version"
            )
        ]

    def __str__(self) -> str:
        return f"{self.channel}:{self.version} ({self.build_id})"
