# Local development

## Toolchains

Use Node.js 22.23.2, npm 10.9.8, Python 3.12, and uv. Run `nvm install` and `nvm use` from the
repository root when using nvm, and confirm `npm --version` reports 10.9.8. Dependency resolution
is committed in `package-lock.json` and `uv.lock`; routine setup must use frozen installs.

## First setup

```bash
cp .env.example .env
npm run install:deps
npm run infra:up
npm run platform:migrate
npm run platform:seed
```

The Compose stack provides only dependencies. Application processes run on the host for fast
reload and straightforward debugging.

| Service | Address |
| --- | --- |
| React/Vite | `http://127.0.0.1:5173` |
| Local timetable API | `http://127.0.0.1:4000/local-api/v1` |
| Django platform API | `http://127.0.0.1:8000/api/v1` |
| Django API docs | `http://127.0.0.1:8000/api/docs/` |
| PostgreSQL | `127.0.0.1:5432` |
| Redis | `127.0.0.1:6379` |
| MinIO API / console | `127.0.0.1:9000` / `http://127.0.0.1:9001` |
| Mailpit SMTP / UI | `127.0.0.1:1025` / `http://127.0.0.1:8025` |

## Daily commands

```bash
npm run infra:up
npm run dev             # web + local API + Electron
npm run dev:browser     # web + local API + platform API, without Electron
npm run dev:worker      # only when testing background jobs
```

Stop dependency containers with `npm run infra:down`. Volumes are retained.

## Development users

Run `npm run platform:seed` whenever demo definitions change. The command is idempotent. Accounts:
`admin`, `headteacher`, `teacher`, `finance`, `hr`, and `guardian`. The password comes from
`MAKTAB_DEMO_PASSWORD`.

## Database work

```bash
uv run --package maktab-platform-api python services/platform-api/manage.py makemigrations
npm run platform:migrate
npm run platform:seed
```

Use Django migrations for platform data. Existing local timetable migrations remain managed by the
TypeORM service. Never copy SQLite tables into Django migrations.

## Verification

```bash
npm run check:desktop    # desktop-v1 backend and shared-renderer gate
npm run check:desktop-security
npm run check:release   # release API migrations, lint, and licensing contracts
npm run build:all        # renderer, local API, and standalone solver
npm run test:update-contract
npm run check:release-inputs
npm run check            # broader monorepo/platform gate
npm run platform:schema
```

`npm run check:desktop-js` applies Node syntax validation to every JavaScript file directly under
`apps/desktop`. `npm run check:desktop-security` validates IPC contracts, URL policy, process
messages, safeStorage behavior, and packaged-resource integrity logic. After packaging on Windows,
run `npm run check:packaged-desktop` and `npm run test:packaged-desktop`. Use `npm run test:solver`
and `npm run test:release` when working on either isolated
Python service. `npm run install:deps` performs `npm ci` plus a frozen sync of the complete uv
workspace, so neither lockfile should change after setup.

Release-service development uses SQLite only for isolated tests. Production is configured through
`config.settings_production` and requires PostgreSQL plus explicit secrets and hosts. Run migrations
with `npm run release:migrate`; use the owner commands described in
[License and release operations](LICENSE_RELEASE_OPERATIONS.md). The local API migration preserves
retired license/trial/contact rows as `legacy_*` tables, but they no longer authorize any action.

Windows signing is deliberately unavailable from ordinary Linux development. GitHub Windows CI
creates disposable trust material and runs `npm run dist:win:internal`. A protected production tag
runs `npm run dist:win:release`; it fails unless a real PFX or complete Azure Trusted Signing
configuration is present. Artifact-dependent release checks remain outside `npm run check:desktop`.

See [Electron security checklist](ELECTRON_SECURITY_CHECKLIST.md) and
[Windows runtime acceptance](WINDOWS_RUNTIME_ACCEPTANCE.md) before promoting a release candidate.

Cloud deployment, domains, TLS termination, managed backups, and production secret injection are a
separate delivery phase and intentionally are not encoded in this local stack.
