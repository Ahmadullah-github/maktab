# License System Implementation Guide

## Overview

Maktab uses a **soft-blocking** license system designed for offline-first
desktop usage. Instead of completely blocking the app, it restricts specific
features based on license/trial status.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LICENSE FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  First Launch (no license, no trial)                                │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────┐                                                │
│  │ Auto-create     │  Machine ID tracked in DeviceTrial table       │
│  │ 7-day trial     │  Prevents trial abuse on reinstall             │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │ Trial Active    │────▶│ Trial Expired   │                        │
│  │ (Full access)   │     │ (Generate blocked)                       │
│  └─────────────────┘     └────────┬────────┘                        │
│                                   │                                  │
│                                   ▼                                  │
│                          ┌─────────────────┐                        │
│                          │ License Activated│                        │
│                          │ (Full access)    │                        │
│                          └────────┬────────┘                        │
│                                   │                                  │
│                                   ▼                                  │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │ Grace Period    │◀────│ License Expired │                        │
│  │ (14 days)       │     │ (Read-only mode)│                        │
│  └─────────────────┘     └─────────────────┘                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## License States

| State           | Mode              | Can Edit | Can Generate | Banner                   |
| --------------- | ----------------- | -------- | ------------ | ------------------------ |
| Trial Active    | `trial`           | ✅       | ✅           | Info (blue, dismissible) |
| Trial Expired   | `trial_expired`   | ✅       | ❌           | Blocking (red)           |
| Licensed        | `licensed`        | ✅       | ✅           | Warning if <30 days      |
| Grace Period    | `grace_period`    | ✅       | ✅           | Warning (amber)          |
| License Expired | `license_expired` | ❌       | ❌           | Readonly (gray)          |

## File Structure

### Backend (packages/api)

```
packages/api/
├── src/
│   ├── entity/
│   │   ├── License.ts           # License records (activated licenses)
│   │   └── DeviceTrial.ts       # Trial tracking per machine ID
│   │
│   ├── services/
│   │   ├── licenseService.ts    # License validation, activation
│   │   └── deviceTrialService.ts # Auto-trial creation, status check
│   │
│   ├── middleware/
│   │   └── licenseMiddleware.ts # Three middleware functions:
│   │                            # - licenseMiddleware (status headers)
│   │                            # - readOnlyMiddleware (block writes)
│   │                            # - generateGuardMiddleware (block generate)
│   │
│   └── routes/
│       └── license.routes.ts    # /api/license/* endpoints
│
└── ormconfig.ts                 # DeviceTrial entity registered
```

### Frontend (packages/web)

```
packages/web/src/
├── stores/
│   └── licenseStore.ts          # Zustand store for license state
│
├── hooks/
│   └── useLicense.ts            # Hook to fetch/manage license status
│                                # Exports: useLicense, useReadOnly, useCanGenerate
│
├── components/
│   └── license/
│       ├── LicenseBanner.tsx    # Top banner component
│       └── index.ts             # Barrel export
│
├── lib/
│   └── api.ts                   # X-Machine-Id header added to all requests
│
└── features/schedule/hooks/
    └── useGenerateSchedule.ts   # License check before generation
```

## Key Components

### 1. DeviceTrial Entity

Tracks 7-day trial per machine ID to prevent abuse:

```typescript
// packages/api/src/entity/DeviceTrial.ts
@Entity()
class DeviceTrial {
  machineId: string; // Unique device identifier (XXXX-XXXX-XXXX)
  trialStartedAt: Date;
  trialExpiresAt: Date;
  trialUsed: boolean; // Always true once created
}
```

### 2. License Middleware

Three separate middleware functions in `licenseMiddleware.ts`:

```typescript
// 1. licenseMiddleware - Applied globally, adds status headers
// Does NOT block any requests
app.use(licenseMiddleware);

// 2. readOnlyMiddleware - Blocks POST/PUT/DELETE when license expired
app.use('/api/teachers', readOnlyMiddleware);
app.use('/api/subjects', readOnlyMiddleware);
// ... other CRUD routes

// 3. generateGuardMiddleware - Blocks generation when trial/license expired
app.use('/api/generate', generateGuardMiddleware);
```

### 3. License Store (Zustand)

```typescript
// packages/web/src/stores/licenseStore.ts
interface LicenseStore {
  status: CombinedLicenseStatus | null;
  machineId: string | null;
  bannerDismissed: boolean;

  // Computed helpers
  getMode(): LicenseMode;
  isReadOnly(): boolean;
  canGenerate(): boolean;
  shouldShowBanner(): boolean;
}
```

### 4. useLicense Hook

```typescript
// packages/web/src/hooks/useLicense.ts
function useLicense() {
  // Fetches status from /api/license/status?machineId=XXX
  // Updates licenseStore
  // Returns: status, mode, isReadOnly, canGenerate, etc.
}

// Convenience hooks
function useReadOnly(): boolean;
function useCanGenerate(): boolean;
```

### 5. LicenseBanner Component

Displays at top of app based on license state:

```typescript
// packages/web/src/components/license/LicenseBanner.tsx
// Banner types: info | warning | blocking | readonly
// Integrated in MainLayout.tsx
```

## API Endpoints

| Endpoint                  | Method | Purpose                             |
| ------------------------- | ------ | ----------------------------------- |
| `/api/license/status`     | GET    | Get combined license + trial status |
| `/api/license/activate`   | POST   | Activate a license key              |
| `/api/license/current`    | GET    | Get current license info            |
| `/api/license/contact`    | POST   | Submit renewal request              |
| `/api/license/machine-id` | GET    | Get server-generated machine ID     |

## Machine ID

Machine ID format: `XXXX-XXXX-XXXX` (12 alphanumeric uppercase)

**Sources:**

1. Electron app provides real hardware fingerprint via
   `window.electronAPI.getMachineId()`
2. Web fallback generates from browser fingerprint, stored in localStorage

**Header:** All API requests include `X-Machine-Id` header (added in
`lib/api.ts`)

## Response Headers

The license middleware adds these headers to all responses:

```
X-License-Mode: trial | licensed | trial_expired | license_expired | grace_period
X-License-ReadOnly: true | false
X-License-CanGenerate: true | false
X-License-ShowBanner: true | false
X-License-BannerType: info | warning | blocking | readonly
X-License-DaysRemaining: number (if <30)
X-Trial-DaysRemaining: number (if in trial)
```

## Common Tasks

### Check if user can generate

```typescript
// In any component
import { useCanGenerate } from '@/hooks/useLicense';

function MyComponent() {
  const canGenerate = useCanGenerate();

  return (
    <Button disabled={!canGenerate}>
      Generate
    </Button>
  );
}
```

### Check if app is read-only

```typescript
import { useReadOnly } from '@/hooks/useLicense';

function MyForm() {
  const isReadOnly = useReadOnly();

  return (
    <Button disabled={isReadOnly}>
      Save
    </Button>
  );
}
```

### Access full license status

```typescript
import { useLicense } from '@/hooks/useLicense';

function LicenseInfo() {
  const { status, mode, daysRemaining } = useLicense();

  return <div>Mode: {mode}, Days: {daysRemaining}</div>;
}
```

## Testing

### Reset trial for testing

```sql
-- Delete trial record to test fresh install
DELETE FROM device_trial WHERE machineId = 'YOUR-MACHINE-ID';
```

### Generate test license

```bash
cd packages/api && npm run license:generate:trial
```

## Related Documentation

- `docs/ONLINE_LICENSE_SYSTEM.md` - Full online activation system spec
- `docs/MAKTAB_WEBSITE_SPECIFICATION.md` - License server & admin dashboard spec

## Troubleshooting

| Issue                | Cause                   | Solution                                      |
| -------------------- | ----------------------- | --------------------------------------------- |
| 403 on all requests  | Old middleware blocking | Ensure new `licenseMiddleware.ts` is deployed |
| Banner not showing   | Store not initialized   | Check `useLicense()` is called in MainLayout  |
| Trial not created    | Missing machine ID      | Check `X-Machine-Id` header in requests       |
| Generate still works | Middleware not applied  | Check `generateGuardMiddleware` in app.ts     |
