# Online License Activation System - Implementation Guide

## Overview

This document describes the complete online license activation system for Maktab. The system consists of three components:

1. **Maktab Desktop App** (this repository) - Client-side implementation
2. **License Server** (separate repository) - Cloud API on Hostinger/Railway
3. **Admin Dashboard** (separate repository) - React management app

---

## Part 1: Maktab App Implementation (This Repository)

### Features to Implement

#### 1.1 Internet Connectivity Service
**Location:** `packages/api/src/services/connectivityService.ts`

```typescript
interface ConnectivityService {
  // Check if internet is available
  isOnline(): Promise<boolean>;
  
  // Check if license server is reachable
  isServerReachable(): Promise<boolean>;
  
  // Get connection status
  getStatus(): ConnectionStatus;
  
  // Subscribe to connectivity changes
  onStatusChange(callback: (status: ConnectionStatus) => void): void;
}

interface ConnectionStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  lastCheckedAt: Date;
}
```

**Implementation Notes:**
- Use `navigator.onLine` for basic check
- Ping license server endpoint for server reachability
- Check every 30 seconds when app is active
- Cache status to avoid excessive requests

#### 1.2 Online License Client
**Location:** `packages/api/src/services/onlineLicenseClient.ts`

```typescript
interface OnlineLicenseClient {
  // Activate license with server
  activate(request: ActivationRequest): Promise<ActivationResponse>;
  
  // Verify license status
  verify(): Promise<VerificationResponse>;
  
  // Check if verification is needed (30 days since last)
  needsVerification(): boolean;
  
  // Get local license status (works offline)
  getLocalStatus(): LocalLicenseStatus;
}

interface ActivationRequest {
  licenseKey: string;           // MKTB-XXXX-XXXX-XXXX-XXXX
  machineId: string;            // From existing machineId service
  schoolName: string;
  province: string;
  adminName: string;
  adminPhone: string;
  adminEmail?: string;
  appVersion: string;
}

interface ActivationResponse {
  success: boolean;
  activationToken?: string;     // JWT token for future verification
  license?: {
    licenseType: string;
    expiresAt: string;
    schoolName: string;
  };
  error?: string;
  message?: string;             // Farsi message
}
```

#### 1.3 Offline Manager
**Location:** `packages/api/src/services/offlineManager.ts`

```typescript
interface OfflineManager {
  // Store activation data locally
  storeActivation(token: string, license: LicenseData): void;
  
  // Get stored activation
  getStoredActivation(): StoredActivation | null;
  
  // Check grace period status
  getGracePeriodStatus(): GracePeriodStatus;
  
  // Update last verified timestamp
  updateLastVerified(): void;
  
  // Check if app should be blocked
  shouldBlockApp(): { blocked: boolean; reason?: string };
}

interface GracePeriodStatus {
  isInGracePeriod: boolean;
  daysRemaining: number;
  gracePeriodStartedAt?: Date;
}
```

**Grace Period Logic:**
- Default grace period: 14 days
- Starts when verification fails due to network error
- Resets on successful verification
- App blocks when grace period expires

#### 1.4 Announcement Handler
**Location:** `packages/api/src/services/announcementHandler.ts`

```typescript
interface AnnouncementHandler {
  // Get unread announcements
  getUnread(): Announcement[];
  
  // Mark announcement as read
  markRead(id: string): void;
  
  // Store announcements from server
  storeAnnouncements(announcements: Announcement[]): void;
  
  // Clear expired announcements
  clearExpired(): void;
}

interface Announcement {
  id: string;
  title: string;              // Farsi
  content: string;            // Farsi, supports basic formatting
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'news' | 'update' | 'maintenance' | 'promotion';
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  actionLabel?: string;
}
```

#### 1.5 Update Checker
**Location:** `packages/api/src/services/updateChecker.ts`

```typescript
interface UpdateChecker {
  // Check for available updates
  checkForUpdates(): Promise<UpdateInfo | null>;
  
  // Get current app version
  getCurrentVersion(): string;
  
  // Compare versions
  isUpdateAvailable(latestVersion: string): boolean;
}

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  changelog?: string;
  isRequired: boolean;
  releasedAt: string;
}
```

**Update Flow:**
1. Server returns latest version info during verification
2. App compares with current version
3. Shows notification if update available
4. User clicks → opens download URL in browser
5. User manually installs downloaded .exe

#### 1.6 Contact/Feedback Service
**Location:** `packages/api/src/services/feedbackService.ts`

```typescript
interface FeedbackService {
  // Submit feedback to server
  submitFeedback(feedback: FeedbackRequest): Promise<FeedbackResponse>;
  
  // Submit support request
  submitSupportRequest(request: SupportRequest): Promise<SupportResponse>;
}

interface FeedbackRequest {
  machineId: string;
  schoolName: string;
  contactPhone: string;
  type: 'feedback' | 'bug_report' | 'feature_request';
  message: string;
  appVersion: string;
}
```

### API Endpoints (Client Calls)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/activate` | POST | Activate license |
| `POST /api/v1/verify` | POST | Verify license status |
| `GET /api/v1/announcements` | GET | Get announcements |
| `POST /api/v1/feedback` | POST | Submit feedback |
| `GET /api/v1/version` | GET | Get latest version info |

### Local Storage Schema

```typescript
// Stored in encrypted SQLite or electron-store
interface LocalLicenseData {
  activationToken: string;      // Encrypted JWT
  licenseKey: string;
  licenseType: string;
  schoolName: string;
  machineId: string;
  activatedAt: string;
  expiresAt: string;
  lastVerifiedAt: string;
  gracePeriodStartedAt?: string;
}

interface LocalAnnouncementData {
  announcements: Announcement[];
  readIds: string[];
  lastFetchedAt: string;
}
```

### Environment Variables

```env
# Add to packages/api/.env
LICENSE_SERVER_URL=https://license.maktab.af/api/v1
LICENSE_SERVER_TIMEOUT=10000
VERIFICATION_INTERVAL_DAYS=30
GRACE_PERIOD_DAYS=14
```

### Electron IPC Handlers

Add to `electron/main.js`:

```javascript
// Online license handlers
ipcMain.handle('license:activate', async (event, request) => { ... });
ipcMain.handle('license:verify', async (event) => { ... });
ipcMain.handle('license:getStatus', async (event) => { ... });
ipcMain.handle('announcements:getUnread', async (event) => { ... });
ipcMain.handle('announcements:markRead', async (event, id) => { ... });
ipcMain.handle('updates:check', async (event) => { ... });
ipcMain.handle('connectivity:getStatus', async (event) => { ... });
```

### UI Components Needed

1. **Activation Screen** (`/activate`)
   - License key input
   - School info form
   - Admin info form
   - Submit button with loading state
   - Error display in Farsi

2. **License Status Widget** (header/sidebar)
   - Shows days remaining
   - Grace period warning
   - Verification status

3. **Announcement Panel**
   - Notification badge
   - Announcement list
   - Priority-based styling
   - Dismiss/mark read

4. **Update Notification**
   - Banner when update available
   - Download button
   - Changelog preview

5. **Blocked Screen**
   - Shows when license invalid
   - Reason in Farsi
   - Contact info
   - Retry verification button

---

## Part 2: License Server (Separate Repository)

> **This section is for manual implementation outside this repository**

### Recommended Hosting

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| **Railway.app** | Free tier available | Easy deploy, managed DB | Limited free hours |
| **Render.com** | Free tier available | Simple, auto-deploy | Cold starts on free |
| **Hostinger VPS** | ~$5/month | Full control | Manual setup |
| **DigitalOcean** | $4/month | Reliable | Manual setup |

### Project Structure

```
maktab-license-server/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Server entry point
│   ├── config/
│   │   └── database.ts        # Database connection
│   ├── middleware/
│   │   ├── auth.ts            # Admin authentication
│   │   ├── signature.ts       # Request signature validation
│   │   └── rateLimit.ts       # Rate limiting
│   ├── routes/
│   │   ├── activation.ts      # /api/v1/activate
│   │   ├── verification.ts    # /api/v1/verify
│   │   ├── announcements.ts   # /api/v1/announcements
│   │   ├── feedback.ts        # /api/v1/feedback
│   │   └── admin/             # Admin API routes
│   ├── services/
│   │   ├── licenseService.ts
│   │   ├── customerService.ts
│   │   ├── announcementService.ts
│   │   ├── signatureService.ts
│   │   └── auditService.ts
│   ├── models/
│   │   ├── License.ts
│   │   ├── Customer.ts
│   │   ├── Announcement.ts
│   │   ├── AuditLog.ts
│   │   └── AppVersion.ts
│   └── utils/
│       ├── logger.ts
│       └── errors.ts
├── migrations/
├── package.json
├── tsconfig.json
└── .env.example
```

### Database Schema (PostgreSQL)

```sql
-- Licenses
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(24) UNIQUE NOT NULL,
  license_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  machine_id VARCHAR(14),
  activated_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoke_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id),
  school_name VARCHAR(255) NOT NULL,
  province VARCHAR(100) NOT NULL,
  admin_name VARCHAR(255) NOT NULL,
  admin_phone VARCHAR(20) NOT NULL,
  admin_email VARCHAR(255),
  last_seen_at TIMESTAMP,
  last_ip VARCHAR(45),
  app_version VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  type VARCHAR(20) DEFAULT 'news',
  target_province VARCHAR(100),
  target_license_type VARCHAR(20),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Announcement reads
CREATE TABLE announcement_reads (
  announcement_id UUID REFERENCES announcements(id),
  machine_id VARCHAR(14) NOT NULL,
  read_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (announcement_id, machine_id)
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  license_id UUID,
  machine_id VARCHAR(14),
  ip_address VARCHAR(45),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- App versions
CREATE TABLE app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  download_url VARCHAR(500) NOT NULL,
  changelog TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  is_latest BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP DEFAULT NOW()
);

-- Admin users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_machine ON licenses(machine_id);
CREATE INDEX idx_customers_province ON customers(province);
```

### API Endpoints

#### Public Endpoints (for Maktab App)

```
POST /api/v1/activate
  Request: { licenseKey, machineId, schoolName, province, adminName, adminPhone, adminEmail, appVersion, signature, timestamp }
  Response: { success, activationToken, license, announcements, latestVersion, signature }

POST /api/v1/verify
  Request: { machineId, activationToken, appVersion, signature, timestamp }
  Response: { success, status, license, announcements, latestVersion, signature }

GET /api/v1/announcements?machineId=XXX&since=ISO_DATE
  Response: { announcements: [...] }

POST /api/v1/feedback
  Request: { machineId, schoolName, contactPhone, type, message, appVersion }
  Response: { success, message }

GET /api/v1/version
  Response: { version, downloadUrl, changelog, isRequired }
```

#### Admin Endpoints (for Admin Dashboard)

```
POST /api/admin/login
GET /api/admin/me

GET /api/admin/licenses
POST /api/admin/licenses/generate
GET /api/admin/licenses/:id
PUT /api/admin/licenses/:id/revoke
PUT /api/admin/licenses/:id/extend

GET /api/admin/customers
GET /api/admin/customers/:id
GET /api/admin/customers/export

GET /api/admin/announcements
POST /api/admin/announcements
PUT /api/admin/announcements/:id
DELETE /api/admin/announcements/:id

GET /api/admin/versions
POST /api/admin/versions
PUT /api/admin/versions/:id/set-latest

GET /api/admin/analytics/overview
GET /api/admin/analytics/by-province
GET /api/admin/feedback
```

### Request Signature

All requests from Maktab app must include a signature:

```typescript
// Client-side (Maktab App)
const timestamp = Date.now();
const payload = JSON.stringify({ ...requestBody, timestamp });
const signature = crypto
  .createHmac('sha256', SECRET_KEY)
  .update(payload)
  .digest('hex');

// Server-side verification
function verifySignature(body: any, signature: string): boolean {
  const payload = JSON.stringify(body);
  const expected = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('hex');
  return signature === expected;
}
```

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/maktab_license

# Security
SECRET_KEY=your-very-long-secret-key-min-32-chars
JWT_SECRET=another-secret-for-jwt-tokens
ADMIN_JWT_SECRET=admin-jwt-secret

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Part 3: Admin Dashboard (Separate Repository)

> **This section is for manual implementation outside this repository**

### Recommended Hosting

- **Vercel** (free) - Best for React apps
- **Netlify** (free) - Also excellent
- **GitHub Pages** - If static build works

### Project Structure

```
maktab-admin-dashboard/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── api/
│   │   └── client.ts          # API client
│   ├── components/
│   │   ├── Layout/
│   │   ├── Licenses/
│   │   ├── Customers/
│   │   ├── Announcements/
│   │   └── Analytics/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Licenses.tsx
│   │   ├── LicenseDetail.tsx
│   │   ├── Customers.tsx
│   │   ├── CustomerDetail.tsx
│   │   ├── Announcements.tsx
│   │   ├── Feedback.tsx
│   │   └── Login.tsx
│   ├── hooks/
│   ├── context/
│   │   └── AuthContext.tsx
│   └── utils/
├── package.json
├── vite.config.ts
└── .env.example
```

### Key Features

1. **Dashboard Overview**
   - License counts (active, expiring, trial, expired)
   - Recent activations
   - Activations by province chart
   - Revenue tracking (manual entry)

2. **License Management**
   - Generate new license keys
   - View all licenses with filters
   - Revoke/extend licenses
   - View activation history

3. **Customer Management**
   - View all customers
   - Filter by province, license type
   - Export to CSV
   - View customer details

4. **Announcements**
   - Create announcements (Farsi)
   - Target by province or license type
   - Set priority and expiry
   - View delivery stats

5. **Feedback/Support**
   - View submitted feedback
   - Mark as resolved
   - Reply (future feature)

6. **Version Management**
   - Add new versions
   - Set download URL
   - Mark as required update
   - Set as latest

### Tech Stack

- React 18 + TypeScript
- Vite for build
- React Router for navigation
- TanStack Query for data fetching
- Tailwind CSS for styling
- Recharts for analytics charts
- React Hook Form for forms

---

## Implementation Priority

### Phase 1: Core (Week 1-2)
1. License Server - Basic activation & verification
2. Maktab App - Connectivity check, activation client
3. Admin Dashboard - License generation & viewing

### Phase 2: Offline Support (Week 3)
1. Maktab App - Offline manager, grace period
2. Maktab App - Local storage encryption
3. License Server - Audit logging

### Phase 3: Communication (Week 4)
1. License Server - Announcements API
2. Admin Dashboard - Announcement management
3. Maktab App - Announcement display

### Phase 4: Polish (Week 5)
1. Update checker
2. Feedback system
3. Analytics dashboard
4. Testing & bug fixes

---

## Security Checklist

- [ ] HTTPS only (SSL certificate)
- [ ] Request signatures on all API calls
- [ ] JWT tokens with expiry
- [ ] Rate limiting on all endpoints
- [ ] Input validation (Zod schemas)
- [ ] SQL injection prevention (parameterized queries)
- [ ] Admin authentication with strong passwords
- [ ] Audit logging for all sensitive operations
- [ ] Encrypted local storage in Maktab app
- [ ] Environment variables for secrets (never commit)

---

## Contact

**Developers:**
- Ahmadullah Ahmadi
- Ahmad Zobeen Farahmand

**Repository:** This document is part of the Maktab timetable application.
