# API Package File Structure Guide

This document explains each file in the `packages/api` directory, why it exists, how it works, and what happens if it's removed.

---

## Core Application Files

### `server.ts`
**Purpose:** Application entry point - bootstraps the Express server

**How it works:**
- Initializes TypeORM database connection
- Creates CacheManager with default configuration
- Creates Express app via `createApp()` from `src/app.ts`
- Starts HTTP server on configured port (default: 4000)

**Integration:** Imports `ormconfig.ts`, `src/app.ts`, `src/database/cache/cacheManager.ts`, `src/utils/logger.ts`, `src/constants.ts`

**If removed:** Application cannot start. This is the main entry point.

---

### `ormconfig.ts`
**Purpose:** TypeORM DataSource configuration

**How it works:**
- Configures SQLite database connection via better-sqlite3
- Registers all entity classes (Teacher, Subject, Room, ClassGroup, etc.)
- Enables synchronize mode (auto-creates tables)
- Configures migration and subscriber paths

**Integration:** Used by `server.ts` to initialize database, imported by repositories

**If removed:** Database connection fails. All data persistence breaks.

---

### `schema.ts`
**Purpose:** Zod validation schemas for timetable solver input

**How it works:**
- Defines comprehensive validation schemas for solver input data
- Validates teachers, subjects, rooms, classes, periods, preferences
- Includes cross-field validation (referential integrity, availability arrays)
- Exports `parseTimetableData()` function for validation

**Integration:** Used by `src/routes/generate.routes.ts` to validate solver input before sending to Python solver

**If removed:** No input validation for timetable generation. Invalid data could crash the solver.

---

## Configuration Files

### `tsconfig.json`
**Purpose:** TypeScript compiler configuration

**How it works:**
- Target: ES2020, Module: CommonJS
- Enables decorators for TypeORM entities
- Output to `dist/` directory
- Strict mode enabled

**If removed:** TypeScript compilation fails.

---

### `vitest.config.ts`
**Purpose:** Vitest test runner configuration

**How it works:**
- Configures test environment as Node.js
- Includes test files matching `*.test.ts` and `*.property.test.ts`
- Sets up coverage reporting

**If removed:** Tests cannot run with `npm test`.

---

### `package.json`
**Purpose:** NPM package configuration

**How it works:**
- Defines dependencies (Express, TypeORM, Zod, etc.)
- Defines scripts for build, test, dev, database management
- Configures package metadata

**If removed:** Cannot install dependencies or run any npm scripts.

---

### `package-lock.json`
**Purpose:** Locked dependency versions

**How it works:** Ensures reproducible builds by locking exact dependency versions

**If removed:** Dependency versions may vary between installs, potentially causing issues.

---

## Utility Scripts

### `db-manager.js`
**Purpose:** Interactive CLI tool for database management

**How it works:**
- Provides menu-driven interface for database operations
- Commands: show tables, statistics, view data, backup, restore
- Can list teachers, subjects, classes, validate data integrity
- Supports both interactive mode and CLI arguments

**Integration:** Standalone script, uses better-sqlite3 directly

**Usage:**
```bash
npm run db           # Interactive mode
npm run db:stats     # Show statistics
npm run db:teachers  # List teachers
```

**If removed:** Lose convenient database inspection/management tool. Not critical for app operation.

---

### `generate-license.js`
**Purpose:** Generate license keys for the application

**How it works:**
- Generates random license keys in format `MKTB-XXXX-XXXX-XXXX-XXXX`
- Supports different license types: trial (14 days), 6-month, annual
- Can generate bulk keys

**Integration:** Standalone script, no dependencies on app code

**Usage:**
```bash
npm run license:generate        # Single 6-month key
npm run license:generate:trial  # Trial key
npm run license:generate:annual # Annual key
```

**If removed:** Cannot generate new license keys via CLI. Not critical for app operation.

---

### `reset-database.js`
**Purpose:** Safely reset (clear) all database data

**How it works:**
- Prompts for double confirmation before deletion
- Creates backup before reset
- Deletes all records from all tables
- Runs VACUUM to reclaim space

**Integration:** Standalone script, uses better-sqlite3 directly

**If removed:** Lose convenient database reset tool. Can still manually delete `timetable.db`.

---

## Data Files

### `timetable.db`
**Purpose:** SQLite database file containing all application data

**How it works:** Binary SQLite database file created/managed by TypeORM

**If removed:** All data is lost. Will be recreated empty on next app start.

---

### `test_data.json`
**Purpose:** Sample test data for manual solver testing

**How it works:** Contains a minimal valid timetable configuration for testing the Python solver

**Integration:** Used with `test_solver.py` for manual testing

**If removed:** Lose sample test data. Not needed for production.

---

## Directories

### `src/`
**Purpose:** Main application source code (TypeScript)

Contains:
- `app.ts` - Express app configuration
- `constants.ts` - Application constants
- `database/` - Repositories, cache, migrations
- `entity/` - TypeORM entity definitions
- `middleware/` - Express middleware
- `routes/` - API route handlers
- `schemas/` - Zod validation schemas
- `services/` - Business logic services
- `types/` - TypeScript type definitions
- `utils/` - Utility functions

**If removed:** Application has no code. Cannot function.

---

### `dist/`
**Purpose:** Compiled JavaScript output

**How it works:** Generated by `npm run build` (TypeScript compiler)

**If removed:** Production build unavailable. Regenerate with `npm run build`.

---

### `data/`
**Purpose:** Data storage directory (currently empty)

**How it works:** Reserved for future data file storage

**If removed:** No impact currently.

---

### `node_modules/`
**Purpose:** NPM dependencies

**If removed:** Reinstall with `npm install`.

---

## Summary

| File | Status | Action |
|------|--------|--------|
| `server.ts` | ✅ Essential | Keep |
| `ormconfig.ts` | ✅ Essential | Keep |
| `schema.ts` | ✅ Essential | Keep |
| `tsconfig.json` | ✅ Essential | Keep |
| `vitest.config.ts` | ✅ Essential | Keep |
| `package.json` | ✅ Essential | Keep |
| `package-lock.json` | ✅ Essential | Keep |
| `db-manager.js` | ✅ Useful | Keep |
| `generate-license.js` | ✅ Useful | Keep |
| `reset-database.js` | ✅ Useful | Keep |
| `timetable.db` | ✅ Data | Keep |
