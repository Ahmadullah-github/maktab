import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("release", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="license",
            name="owner_reference",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="license",
            name="expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="license",
            name="revoked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="license",
            name="revocation_reason",
            field=models.CharField(blank=True, max_length=256),
        ),
        migrations.AddField(
            model_name="activation",
            name="deactivation_reason",
            field=models.CharField(blank=True, max_length=256),
        ),
        migrations.CreateModel(
            name="IdempotencyRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scope", models.CharField(max_length=32)),
                ("key", models.CharField(max_length=128)),
                ("request_digest", models.CharField(max_length=64)),
                ("state", models.CharField(choices=[("pending", "Pending"), ("complete", "Complete")], default="pending", max_length=16)),
                ("response_ciphertext", models.BinaryField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("expires_at", models.DateTimeField()),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("scope", "key"), name="unique_idempotency_scope_key")]},
        ),
        migrations.CreateModel(
            name="LicenseAuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=64)),
                ("outcome", models.CharField(choices=[("success", "Success"), ("denied", "Denied")], max_length=16)),
                ("actor", models.CharField(blank=True, max_length=128)),
                ("reason", models.CharField(blank=True, max_length=256)),
                ("error_code", models.CharField(blank=True, max_length=64)),
                ("request_id", models.CharField(blank=True, max_length=64)),
                ("network_fingerprint", models.CharField(blank=True, max_length=64)),
                ("device_fingerprint", models.CharField(blank=True, max_length=64)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("activation", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to="release.activation")),
                ("license", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to="release.license")),
            ],
        ),
        migrations.AddIndex(
            model_name="licenseauditevent",
            index=models.Index(fields=["action", "created_at"], name="license_audit_action_time"),
        ),
        migrations.CreateModel(
            name="SecuritySignal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(max_length=64)),
                ("fingerprint", models.CharField(max_length=64)),
                ("severity", models.CharField(choices=[("info", "Info"), ("warning", "Warning"), ("critical", "Critical")], max_length=16)),
                ("count", models.PositiveIntegerField(default=1)),
                ("first_seen_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
                ("last_error_code", models.CharField(blank=True, max_length=64)),
                ("metadata", models.JSONField(blank=True, default=dict)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("category", "fingerprint"), name="unique_security_signal")]},
        ),
        migrations.CreateModel(
            name="RateLimitBucket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scope", models.CharField(max_length=32)),
                ("fingerprint", models.CharField(max_length=64)),
                ("window_start", models.DateTimeField()),
                ("request_count", models.PositiveIntegerField(default=0)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("scope", "fingerprint", "window_start"), name="unique_rate_limit_bucket")]},
        ),
    ]
