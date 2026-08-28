# Production desktop releases

## Release lanes

The Windows workflow has intentionally separate trust boundaries:

- Pull requests create a test-signed internal package. Their certificates and
  acceptance-server TLS material are disposable, retained for seven days, and prohibited from
  production publication.
- Main/manual runs use one Windows job to build v1.0.0 and v1.0.1, inspect the target package,
  exercise tamper and smoke tests, and verify a real installed update and persistence lifecycle.
- An exact `v<package-version>` tag enters the protected `desktop-production-release` environment.
  It cannot fall back to internal or unsigned signing.

The tag job depends on the Linux desktop gate, verifies that the tagged commit belongs to
`origin/main`, signs the solver before hashing, signs the app and NSIS installer, validates the
publisher and RFC 3161 timestamps, and audits ASAR/resources before publication.

## Protected environment inputs

Configure the following only in the `desktop-production-release` GitHub environment and require a
human reviewer:

- Authenticode: `WINDOWS_SIGNING_PFX_BASE64` and `WINDOWS_SIGNING_PFX_PASSWORD`, or the Azure
  identity secrets plus `MAKTAB_AZURE_*` variables.
- Trust: `MAKTAB_LICENSE_PUBLIC_KEYS_JSON`, `MAKTAB_UPDATE_PUBLIC_KEYS_JSON`, the two production
  private signing-key rings, and their active key IDs.
- Release API: exact HTTPS URL/hosts/origins, independent Django/idempotency secrets, and the
  production PostgreSQL URL.
- Release identity: exact Authenticode publisher, allowed GitHub/CDN origins, release channel, and
  optional initial rollout percentage.

Enable GitHub immutable releases, protect `v*` tags, restrict the environment to protected tags,
and require the branch gate before creating the first production tag. These repository settings are
external controls and cannot be replaced by workflow source.

## Publication transaction

The production job creates a draft release and uploads the installer, blockmap, channel YAML,
release descriptor, hashes, and provenance. It verifies the remote asset set, registers the release
identity disabled in the production service, publishes the GitHub release, sets deterministic
rollout, and finally enables it. A failure before publication leaves a draft; a failure before the
last step leaves the service disabled.

Published assets are never replaced. To correct an artifact, increment the package version and
produce a new protected tag. To stop distribution without changing immutable identity, run
`release:disable-desktop` and preserve its audit event.

## Fast Windows debugging

Do not use repeated pushes to `main` as a Windows debugger. Once a change has passed the local
Linux checks, push it to a temporary branch and manually run `Desktop v1` with `windows_only=true`.
That mode skips the already-proven Linux job and runs the single canonical Windows update job. The
job uploads small manifest/hash diagnostics after a failure and uploads the complete release pair
only after success, avoiding an approximately 800 MiB failure artifact.

```sh
debug_branch=$(git branch --show-current)
gh workflow run desktop-v1.yml --ref "$debug_branch" -f windows_only=true
run_id=$(gh run list --workflow "Desktop v1" --branch "$debug_branch" \
  --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status --interval 15
gh run view "$run_id" --log-failed
```

Downloaded Windows artifacts can be structurally inspected from the Ubuntu host with:

```sh
npm run check:release-package:portable -- /path/to/release-pair/v1.0.1
```

Portable inspection checks ASAR, fuses, embedded configuration, component hashes, release evidence,
and update metadata. Authenticode chain and timestamp validation remains a Windows-only check.

Keep the clean Windows 10 VM for installation and acceptance. If sub-five-minute Windows build
iteration becomes necessary, create a separate linked-clone development VM or a trusted self-hosted
runner; never install build tools in the clean acceptance snapshot and never expose a self-hosted
signing runner to untrusted pull requests.

## Current completion boundary

The internal engineering gate can pass with disposable signing. Full Phase 6 completion requires a
real Authenticode identity, live HTTPS release API/PostgreSQL, production license/update key rings,
immutable-release and tag protections, and two production-signed builds. Until those exist, no CI
artifact is a public customer release.
