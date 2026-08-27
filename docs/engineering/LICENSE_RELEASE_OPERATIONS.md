# License and release operations

## Authority and data boundary

The release service is the only license authority. It stores license-key hashes, activation state,
rotating refresh-credential hashes, audit events, and security signals. Desktop and local API code
accept only an Ed25519-signed lease with the correct product, audience, device, entitlement, time
window, and trusted key ID.

The local timetable SQLite database is never deleted or replaced by a licensing action. Migration
`1785200000000-RetireLegacyLicenseAuthority` renames the old `license`, `device_trial`, and
`contact_request` tables to `legacy_*`, preserving their rows for compatibility review while
removing their entities and services from runtime ownership. Expiry, deactivation, revocation, and
device reset disable new timetable generation only; existing school and timetable data remains
readable, editable, exportable, and backup-capable.

## Production settings

Run WSGI with `DJANGO_SETTINGS_MODULE=config.settings_production`. Startup fails when any required
value is absent:

- `MAKTAB_RELEASE_DJANGO_SECRET`: independent high-entropy Django secret.
- `MAKTAB_RELEASE_ALLOWED_HOSTS`: comma-separated exact service hosts.
- `MAKTAB_RELEASE_CSRF_TRUSTED_ORIGINS`: comma-separated HTTPS admin origins.
- `MAKTAB_RELEASE_DATABASE_URL`: PostgreSQL URL; SQLite is rejected.
- `MAKTAB_IDEMPOTENCY_ENCRYPTION_KEY`: independent high-entropy secret used to encrypt replay
  responses containing rotated refresh credentials.
- `MAKTAB_LICENSE_SIGNING_KEYS` and `MAKTAB_LICENSE_ACTIVE_KEY_ID`: JSON private-key ring and active
  license signing key.
- `MAKTAB_UPDATE_SIGNING_KEYS` and `MAKTAB_UPDATE_ACTIVE_KEY_ID`: JSON private-key ring and active
  update signing key.

Private-key rings are JSON objects whose keys are stable key IDs and whose values are base64-encoded
raw 32-byte Ed25519 private keys (or base64-encoded PEM). Store them only in the production secret
manager. Public-key rings use the format in `release-keys/README.md` and are the only keys packaged
with Electron. The packaging hook validates and copies them into the integrity-protected ASAR; they
must not be emitted as mutable external resources.

Production forces debug off, HTTPS redirect, secure cookies, HSTS, strict hosts, proxy HTTPS
interpretation, and PostgreSQL TLS (`sslmode=require` by default). The trusted reverse proxy must
overwrite `X-Forwarded-For` and `X-Forwarded-Proto`, enforce the same 16 KiB request limit, and never
forward client-supplied proxy headers unchanged.

Apply deterministic migrations before serving traffic:

```bash
npm run release:migrate
npm run check:release
```

## Owner workflows

All owner actions require an authenticated operator, a ticket/reference, and a reason. Django admin
exposes read-only audit/security records; use these commands for repeatable sensitive operations.

Create a license (the raw key is printed once and cannot be recovered):

```bash
npm run release:create-license -- --owner-reference SCHOOL-123 --channel stable
```

Revoke a license and every active device:

```bash
npm run release:revoke-license -- 42 --reason "contract ended; ticket LIC-1002"
```

Transfer to a replacement computer, or recover a lost device, by releasing the old activation slot.
The owner then activates the same license key on the new device:

```bash
npm run release:reset-device -- 77 --mode transfer --reason "approved replacement; LIC-1003"
npm run release:reset-device -- 77 --mode lost-device --reason "identity verified; LIC-1004"
```

Registering a desktop release is a separate immutable operation. Registration always creates a
disabled, zero-percent record; only rollout and enabled state can change afterward:

```bash
npm run release:register-desktop -- dist-electron/release-descriptor.json \
  --actor "release-owner" --reason "REL-1001"
npm run release:set-rollout -- 1.0.0-stable-0123456789ab 10 \
  --actor "release-owner" --reason "pilot cohort; REL-1001"
npm run release:enable-desktop -- 1.0.0-stable-0123456789ab \
  --actor "release-owner" --reason "verified public release; REL-1001"
npm run release:disable-desktop -- 1.0.0-stable-0123456789ab \
  --actor "release-owner" --reason "incident response; REL-1002"
```

Before a reset, verify the owner through the approved support channel and match the stored owner
reference and device support code. Never request a refresh token, private key, timetable database,
or OS credential-store contents. Revocation is final unless a separate reviewed process creates a
new license.

## Idempotency, monitoring, and incident response

Activation, refresh, and deactivation require an idempotency key. The service stores a request
digest and an AES-GCM-encrypted response for two days. An exact retry replays the original lease and
refresh token; reusing a key with another payload returns `IDEMPOTENCY_CONFLICT`; an overlapping
request returns retryable `IDEMPOTENCY_IN_PROGRESS`. A refresh token is single-use outside its
original idempotent replay.

Database-backed rate limits apply per proxy-verified network fingerprint. Invalid keys, stale
credentials, device mismatches, device-limit attempts, and rate-limit events create aggregated
security signals. Successful and denied lifecycle operations create separate immutable audit rows.
Review Django admin for elevated signal counts and correlate by request ID; fingerprints are salted
hashes and raw client addresses are not stored.

Run `npm run release:cleanup` from a daily scheduler to remove expired encrypted idempotency
responses and obsolete rate-limit buckets. Audit events and aggregated security signals are not
deleted by this command and remain subject to the release-service evidence-retention policy.

On suspected key exposure, disable signing traffic, preserve audit evidence, add a replacement
public key to clients, activate the replacement private key, revoke affected licenses where needed,
and follow the overlap rules below. Never place a private key in a support bundle or CI artifact.

## Key rotation and overlap

1. Generate the replacement Ed25519 pair in the secret-management boundary.
2. Add its public key beside the retiring public key in both pilot and stable desktop key rings.
3. Ship and measure adoption of that trust-ring release while the server still signs with the old
   key.
4. Add the replacement private key to the server ring and switch only the active key ID. New leases
   and manifests now use the replacement key; old private keys can be removed from online service
   configuration after rollback approval.
5. Keep the retiring public key in every supported desktop for at least the maximum lease plus grace
   window and clock tolerance after the last old-key lease was issued. With current defaults this is
   30 + 7 days, so the operational minimum is 38 full days.
6. Remove the retiring public key only after supported-client adoption and the overlap timestamp are
   both confirmed. Apply the same publish-before-switch rule to update-manifest keys.

Changing an active key ID before clients trust its public key is a release-blocking outage. Removing
an old public key early strands valid offline leases.

## Phase 3 release evidence

The release candidate must record the commit, database migration state, active and overlapping key
IDs, configured lease/grace durations, production settings check, and results of `npm run
check:desktop`. Automated evidence covers request contracts, idempotent replay, stale credentials,
revoked/disabled/expired licenses, rate limits, request size, tampered leases, device mismatch,
grace, clock rollback, key overlap, legacy-table preservation, and transfer. The later Windows
acceptance run confirms safeStorage persistence and end-to-end activation/recovery without changing
the timetable database.
