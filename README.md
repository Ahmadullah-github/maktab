# Maktab School Platform

Maktab is an offline-capable timetable generator growing into a multi-tenant school operations
platform for Afghanistan. The same React renderer runs in a browser and inside Electron. Timetable
generation remains local; school management data is authoritative in PostgreSQL through Django.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Shared responsive React renderer for browser and Electron |
| `apps/desktop` | Electron lifecycle, protected IPC, local service, secure platform token transport |
| `services/local-api` | Offline timetable API and SQLite database (`/local-api/v1`) |
| `services/platform-api` | Online Django/DRF multi-tenant API (`/api/v1`) |
| `services/timetable-solver` | Python/OR-Tools scheduling engine |
| `infra/dev` | PostgreSQL, Redis, MinIO, and Mailpit for local development |
| `docs/school-platform` | Product decisions, architecture, and feature implementation trackers |
| `docs/engineering` | Developer runbooks and system boundaries |

## Local quick start

Requirements: Node.js 22.23.2, npm 10.9.8, Python 3.12,
[uv](https://docs.astral.sh/uv/), and Docker with Compose. The Node and npm versions are declared
in `.nvmrc` and `package.json`; Python packages are locked by `uv.lock`.

```bash
cp .env.example .env
npm run install:deps
npm run infra:up
npm run platform:migrate
npm run platform:seed
npm run dev
```

`npm run dev` starts the web renderer, local timetable API, and Electron. Use
`npm run dev:browser` to run the renderer, local API, and Django platform API without Electron.

Development accounts are `admin`, `headteacher`, `teacher`, `finance`, `hr`, and `guardian`.
Their shared local-only password is configured by `MAKTAB_DEMO_PASSWORD` in `.env.example`.

## Verification

```bash
npm run check:desktop
npm run check:desktop-security
npm run build:all
```

These are the canonical desktop-v1 gates. They validate the workspace dependency tree, all direct
Electron JavaScript entries, the shared renderer, local API, timetable solver, and release API,
then build the renderer, local API, and standalone solver artifact. The broader platform gate is:

```bash
npm run check
```

It additionally checks the Django platform API and remains the monorepo gate for platform work.
Individual Python suites can be run with:

```bash
npm run test:solver
npm run test:release
```

Windows release work provides `npm run dist:win:internal`, `npm run dist:win:release`,
`npm run check:release-package`, and `npm run test:update-contract`. The internal lane requires a
disposable CI certificate and produces seven-day acceptance artifacts. The production lane has no
unsigned fallback and requires a protected Authenticode identity, production key rings, exact
version tag, and production release-service configuration.

The independent release service uses signed leases as the only desktop license authority. Its
production configuration, owner workflows, key rotation, and recovery procedures are documented
in [License and release operations](docs/engineering/LICENSE_RELEASE_OPERATIONS.md).
The signing lanes, protected GitHub publication transaction, and remaining external production
prerequisites are documented in [Production desktop releases](docs/engineering/PRODUCTION_DESKTOP_RELEASES.md).

See [Local development](docs/engineering/LOCAL_DEVELOPMENT.md) and
[system architecture](docs/school-platform/SYSTEM_ARCHITECTURE.md) for more detail.
