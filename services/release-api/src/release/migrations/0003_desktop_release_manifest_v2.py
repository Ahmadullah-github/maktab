from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("release", "0002_license_hardening")]

    operations = [
        migrations.AddField(
            model_name="desktoprelease",
            name="artifact_filename",
            field=models.CharField(default="legacy.exe", max_length=160),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="desktoprelease",
            name="artifact_sha256",
            field=models.CharField(default="0" * 64, max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="desktoprelease",
            name="release_config_sha256",
            field=models.CharField(default="0" * 64, max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="desktoprelease",
            name="updater_metadata_sha256",
            field=models.CharField(default="0" * 64, max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="desktoprelease",
            name="updater_metadata_url",
            field=models.URLField(default="https://invalid.example/legacy.yml"),
            preserve_default=False,
        ),
    ]
