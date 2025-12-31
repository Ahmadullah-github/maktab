# Design Document: Online License Activation (Maktab App Client)

## Overview

This design covers the client-side implementation in the Maktab desktop app for integrating with the external license server. The implementation adds:

1. **Connectivity Service**: Detect internet availability
2. **License Client**: API communication with signing
3. **Verification Service**: Periodic license checks
4. **Grace Period Manager**: Offline fallback handling
5. **Announcement Handler**: Display server announcements
6. **Update Checker**: Version comparison and notifications
7. **Feedback Service**: Send user messages to server

**Note:** Server implementation is documented in `docs/MAKTAB_WEBSITE_SPECIFICATION.md`

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAKTAB DESKTOP APP                                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Electron Main Process                           │ │
│  │  ┌─────────────────┐                                                   │ │
│  │  │  machineId.js   │  (existing - generates hardware ID)               │ │
│  │  └─────────────────┘                                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        API Layer (packages/api)                        │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │Connectivity │  │  License    │  │Verification │  │   Grace     │   │ │
│  │  │  Service    │  │   Client    │  │  Service    │  │  Period     │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │Announcement │  │   Update    │  │  Feedback   │  │  Signature  │   │ │
│  │  │  Handler    │  │   Checker   │  │  Service    │  │  Service    │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                              │                                         │ │
│  │                              ▼                                         │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │              Local SQLite (existing database)                   │   │ │
│  │  │  + online_license | announcements_cache | feedback_queue       │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (only when online)
                                    ▼
                    ┌───────────────────────────────┐
                    │   https://maktab.af/api/      │
                    │   (External License Server)   │
                    └───────────────────────────────┘
```

## Components and Interfaces

### 1. Server Configuration

**File**: `packages/api/src/config/licenseServer.ts`

```typescript
export const LICENSE_SERVER_CONFIG = {
  BASE_URL: process.env.LICENSE_SERVER_URL || 'https://maktab.af',
  ENDPOINTS: {
    HEALTH: '/api/health',
    ACTIVATE: '/api/activate',
    VERIFY: '/api/verify',
    ANNOUNCEMENTS: '/api/announcements',
    VERSION: '/api/version',
    FEEDBACK: '/api/feedback'
  },
  VERIFICATION_INTERVAL_DAYS: 30,
  GRACE_PERIOD_DAYS: 14,
  REQUEST_TIMEOUT_MS: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};
```

### 2. Connectivity Service

**File**: `packages/api/src/services/connectivityService.ts`

```typescript
interface ConnectivityService {
  // Check if license server is reachable
  isOnline(): Promise<boolean>;
  
  // Get current connectivity status (cached)
  getStatus(): ConnectivityStatus;
  
  // Subscribe to connectivity changes
  onStatusChange(callback: (status: ConnectivityStatus) => void): void;
}

interface ConnectivityStatus {
  isOnline: boolean;
  lastCheckedAt: Date;
  lastOnlineAt: Date | null;
}
```

### 3. Signature Service

**File**: `packages/api/src/services/signatureService.ts`

```typescript
interface SignatureService {
  // Sign outgoing request payload
  signRequest(payload: object): SignedPayload;
  
  // Verify incoming response signature
  verifyResponse(response: SignedResponse): boolean;
}

interface SignedPayload {
  ...payload;
  timestamp: number;
  signature: string;
}

interface SignedResponse {
  ...data;
  timestamp: number;
  signature: string;
}
```

### 4. License Client

**File**: `packages/api/src/services/onlineLicenseClient.ts`

```typescript
interface OnlineLicenseClient {
  // Activate license with server
  activate(request: ActivationRequest): Promise<ActivationResult>;
  
  // Verify license with server
  verify(): Promise<VerificationResult>;
  
  // Open browser for activation
  openActivationPage(machineId: string): void;
}

interface ActivationRequest {
  licenseKey: string;
  machineId: string;
  appVersion: string;
}

interface ActivationResult {
  success: boolean;
  error?: string;
  message?: string;
  license?: {
    licenseKey: string;
    licenseType: string;
    activatedAt: string;
    expiresAt: string;
    schoolName: string;
  };
  announcements?: Announcement[];
}

interface VerificationResult {
  success: boolean;
  status: 'valid' | 'expired' | 'revoked' | 'network_error';
  error?: string;
  message?: string;
  license?: {
    expiresAt: string;
    daysRemaining: number;
  };
  announcements?: Announcement[];
  latestVersion?: VersionInfo;
}
```

### 5. Verification Service

**File**: `packages/api/src/services/verificationService.ts`

```typescript
interface VerificationService {
  // Check if verification is needed
  needsVerification(): boolean;
  
  // Perform verification (if online)
  performVerification(): Promise<VerificationResult>;
  
  // Get days since last verification
  getDaysSinceLastVerification(): number;
  
  // Update last verified timestamp
  updateLastVerified(): void;
}
```

### 6. Grace Period Manager

**File**: `packages/api/src/services/gracePeriodManager.ts`

```typescript
interface GracePeriodManager {
  // Check if currently in grace period
  isInGracePeriod(): boolean;
  
  // Get remaining grace days
  getGraceDaysRemaining(): number;
  
  // Check if app should be blocked
  shouldBlockApp(): boolean;
  
  // Start grace period (on verification failure)
  startGracePeriod(): void;
  
  // Reset grace period (on successful verification)
  resetGracePeriod(): void;
  
  // Get comprehensive license status
  getLicenseStatus(): OnlineLicenseStatus;
}

interface OnlineLicenseStatus {
  isActivated: boolean;
  isValid: boolean;
  isBlocked: boolean;
  blockReason?: 'expired' | 'revoked' | 'grace_expired' | 'not_activated';
  licenseType?: string;
  expiresAt?: Date;
  daysRemaining?: number;
  lastVerifiedAt?: Date;
  isInGracePeriod: boolean;
  graceDaysRemaining?: number;
  needsVerification: boolean;
}
```

### 7. Announcement Handler

**File**: `packages/api/src/services/announcementHandler.ts`

```typescript
interface AnnouncementHandler {
  // Store announcements from server
  storeAnnouncements(announcements: Announcement[]): void;
  
  // Get unread announcements
  getUnreadAnnouncements(): Announcement[];
  
  // Mark announcement as read
  markAsRead(announcementId: string): void;
  
  // Clear expired announcements
  clearExpired(): void;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'news' | 'update' | 'maintenance' | 'promotion';
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  expiresAt?: string;
}
```

### 8. Update Checker

**File**: `packages/api/src/services/updateChecker.ts`

```typescript
interface UpdateChecker {
  // Check for updates (from verification response)
  checkForUpdates(versionInfo: VersionInfo): UpdateStatus;
  
  // Open download URL in browser
  openDownloadPage(): void;
  
  // Get current app version
  getCurrentVersion(): string;
}

interface VersionInfo {
  version: string;
  isUpdateAvailable: boolean;
  isRequired: boolean;
  downloadUrl: string;
  changelog?: string;
}

interface UpdateStatus {
  hasUpdate: boolean;
  isRequired: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
  changelog?: string;
}
```

### 9. Feedback Service

**File**: `packages/api/src/services/feedbackService.ts`

```typescript
interface FeedbackService {
  // Submit feedback to server
  submitFeedback(feedback: FeedbackRequest): Promise<FeedbackResult>;
  
  // Queue feedback for later (if offline)
  queueFeedback(feedback: FeedbackRequest): void;
  
  // Send queued feedback (when online)
  sendQueuedFeedback(): Promise<void>;
}

interface FeedbackRequest {
  subject?: string;
  message: string;
  type: 'feedback' | 'bug_report' | 'feature_request' | 'support';
  contactName?: string;
  contactPhone?: string;
}
```

## Data Models

### New Database Tables

```sql
-- Online license storage (extends existing License table concept)
CREATE TABLE online_license (
  id INTEGER PRIMARY KEY,
  license_key TEXT NOT NULL,
  license_type TEXT NOT NULL,
  school_name TEXT,
  activated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_verified_at TEXT,
  grace_period_start TEXT,
  is_blocked INTEGER DEFAULT 0,
  block_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Cached announcements
CREATE TABLE announcements_cache (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  type TEXT DEFAULT 'news',
  action_url TEXT,
  action_label TEXT,
  expires_at TEXT,
  is_read INTEGER DEFAULT 0,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Queued feedback (for offline submission)
CREATE TABLE feedback_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'feedback',
  contact_name TEXT,
  contact_phone TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  retry_count INTEGER DEFAULT 0
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Connectivity Check Timeout
*For any* connectivity check, the check SHALL complete within 5 seconds regardless of network conditions.
**Validates: Requirements 1.2**

### Property 2: Activation URL Format
*For any* machine ID, the generated activation URL SHALL match the pattern `https://maktab.af/activate?mid={machineId}` where machineId is URL-encoded.
**Validates: Requirements 2.1, 2.2**

### Property 3: License Storage Round Trip
*For any* successful activation, storing and then retrieving the license data SHALL return equivalent values for licenseKey, licenseType, expiresAt, and schoolName.
**Validates: Requirements 3.2, 10.2**

### Property 4: Verification Timing
*For any* license, needsVerification() SHALL return true if and only if more than 30 days have passed since lastVerifiedAt.
**Validates: Requirements 4.1**

### Property 5: Grace Period Calculation
*For any* license in grace period, getGraceDaysRemaining() SHALL return a value between 0 and 14, decreasing by 1 each day since grace period started.
**Validates: Requirements 5.1, 5.2**

### Property 6: Grace Period Blocking
*For any* license where grace period has expired (graceDaysRemaining <= 0), shouldBlockApp() SHALL return true.
**Validates: Requirements 5.3**

### Property 7: Expired License Blocking
*For any* license where expiresAt is in the past, shouldBlockApp() SHALL return true regardless of grace period status.
**Validates: Requirements 5.5**

### Property 8: Request Signature Validity
*For any* signed request, the signature SHALL be a valid HMAC-SHA256 hash of the payload concatenated with timestamp.
**Validates: Requirements 9.1**

### Property 9: Response Signature Verification
*For any* response with an invalid signature (tampered data), verifyResponse() SHALL return false.
**Validates: Requirements 9.2**

### Property 10: Announcement Read State
*For any* announcement marked as read, getUnreadAnnouncements() SHALL not include that announcement.
**Validates: Requirements 6.3**

## Error Handling

| Error Condition | Handling | User Message (Farsi) |
|-----------------|----------|---------------------|
| Network timeout | Retry up to 3 times, then fail gracefully | اتصال به سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید |
| Invalid license key format | Reject before API call | فرمت کلید لایسنس نامعتبر است |
| Server returns error | Display server's Farsi message | (from server response) |
| Invalid response signature | Reject response, log security event | خطای امنیتی. لطفاً با پشتیبانی تماس بگیرید |
| License expired | Block app, show renewal info | لایسنس شما منقضی شده است. برای تمدید اقدام کنید |
| License revoked | Block app, show contact info | لایسنس شما لغو شده است. برای اطلاعات بیشتر تماس بگیرید |
| Grace period expired | Block app, require verification | برای ادامه استفاده، اتصال اینترنت لازم است |

## Testing Strategy

### Property-Based Testing

Property-based tests will use **fast-check** library:

- Connectivity timeout property
- URL generation property
- License storage round trip
- Verification timing logic
- Grace period calculations
- Signature generation/verification
- Announcement filtering

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `**Feature: online-license-activation, Property {N}: {description}**`

### Test File Structure

```
packages/api/src/services/__tests__/
├── connectivityService.test.ts
├── connectivityService.property.test.ts
├── signatureService.property.test.ts
├── onlineLicenseClient.test.ts
├── verificationService.property.test.ts
├── gracePeriodManager.property.test.ts
├── announcementHandler.property.test.ts
└── updateChecker.test.ts
```
