# Windows runtime acceptance

Complete one copy of this record for every Phase 6 internal release pair. Internal packages use a
disposable test certificate and are never public release artifacts. The production lane accepts
only a real protected Authenticode identity.

Phase 6 artifacts target Windows x64 exclusively. Launching a staged package from the Ubuntu host
must fail with `This release only supports Windows x64`; that is the expected fail-closed target
check, not a local-service failure. Install and exercise the `.exe` only inside the Windows guest.

## Prepare the Windows 10 VM

The VM is an acceptance machine, not a build machine. Shut it down before snapshot operations. On
the host, record its state and create the first snapshot before installing Guest Additions:

```bash
scripts/acceptance/prepare-win10-vm.sh status
scripts/acceptance/prepare-win10-vm.sh snapshot-pre-additions
```

Start Windows, install the matching VirtualBox Guest Additions, apply all Windows updates, and
confirm Windows has no Node.js, Python, SQLite CLI, Git, or compiler toolchain. Shut down and create
the reusable clean snapshot:

```bash
scripts/acceptance/prepare-win10-vm.sh snapshot-ready
scripts/acceptance/prepare-win10-vm.sh share-artifacts /var/tmp/maktab-acceptance
```

Run VBoxManage and this helper as the normal desktop user, never through `sudo`: VirtualBox keeps a
separate VM registry per host account. The shared folder is read-only and must contain only the
downloaded CI artifact. Never share the repository or the host home directory. Import the
disposable internal CA into the guest only after the ready snapshot. Revert to
`win10-acceptance-ready` after the run so test trust and application data do not contaminate later
acceptance.

Download the seven-day `maktab-timetable-update-e2e-*` artifact from the successful main/manual
workflow into the dedicated host directory. From the repository on the host, serve its already
signed static update fixture (the disposable private update-signing key is not present):

For hands-on debugging before the automated lifecycle is green, manually dispatch `Desktop v1`
with `windows_only=true`. Every manual run uploads a seven-day
`maktab-timetable-vm-acceptance-*` artifact immediately after package/signature verification, even
when a later negative, smoke, or installed-update test fails.

```bash
sudo sh -c 'printf "127.0.0.1 updates.internal.maktab.test\n" >> /etc/hosts'
MAKTAB_INTERNAL_UPDATE_BIND=0.0.0.0 \
  node scripts/packaging/internal-update-server.js /dedicated/artifact/release-pair/v1.0.1
```

In an elevated guest PowerShell, map `updates.internal.maktab.test` to the VirtualBox NAT host at
`10.0.2.2`, import `acceptance-server/internal-test-ca.cer` into Current User Trusted Root, and
import `internal-code-signing.cer` into Current User Trusted Publishers. The TLS leaf chains to the
same disposable CA. These certificates and the bundled TLS fixture are internal test material;
never copy them to a production release or retain them after reverting the VM.

The downloaded CI artifact also contains the acceptance PowerShell script. Inside the guest, run
the preflight against the base release from a writable evidence directory:

```powershell
powershell -ExecutionPolicy Bypass -File Z:\scripts\acceptance\windows10-acceptance.ps1 `
  -ArtifactDirectory Z:\release-pair\v1.0.0 `
  -EvidenceDirectory C:\MaktabAcceptanceEvidence
```

The preflight requires 12 GB free disk, proves developer runtimes are absent, verifies all supplied
hashes, and records the installer publisher and RFC 3161 timestamp.
Use `Z:\release-pair\acceptance-server\internal-qa-license.txt` for the disposable activation.
For the negative update checks, set the host artifact's
`release-pair/v1.0.1/acceptance-scenario.txt` to `tampered-manifest`, `wrong-publisher`, or
`corrupt-artifact`, run the corresponding check/download in the guest, record the rejection, and
restore the file to `normal` before the successful update.

## Build evidence

- Commit:
- CI run:
- Package SHA-256:
- Electron / electron-builder / electron-updater versions:
- Tester and date:

## Test matrix

Run the complete matrix on a clean, fully patched Windows 10 x64 VM and a clean, fully patched
Windows 11 x64 VM. Neither VM may have Node.js, Python, SQLite, or developer tooling installed.

| Scenario | Windows 10 | Evidence / notes |
| --- | --- | --- |
| Internal v1.0.0 installs and starts without developer runtimes | | |
| QA license activation succeeds and safeStorage survives restart | | |
| Minimal school fixture generates and persists a timetable | | |
| Internal v1.0.1 downloads and installs | | |
| Build ID, activation, database, and timetable survive the update | | |
| PDF/Excel export and Microsoft Print to PDF succeed | | |
| Tampered and wrong-publisher updates are rejected | | |
| Cross-origin navigation and popups open nothing | | |
| Clean shutdown leaves no local API or solver process | | |

Attach the generated JSON, application logs, screenshots, CI run URL, certificate evidence, and
artifact hashes. Any startup, security, data-loss, generation, update, persistence, or printing
failure blocks the internal Phase 6 gate. Windows 11 remains Phase 7.
