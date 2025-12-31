# Requirements Document

## Introduction

This feature implements the client-side integration for the online license activation system in the Maktab desktop application. The system enables the app to communicate with the external license server (maktab.af) for license activation, periodic verification, announcements, and updates. The app remains offline-first, only requiring internet for activation and periodic checks.

**Note:** The license server and admin dashboard are built separately. See `docs/MAKTAB_WEBSITE_SPECIFICATION.md` for server specifications.

## Glossary

- **License Server**: External cloud service at maktab.af that handles license validation
- **Machine ID**: A unique hardware fingerprint generated from the user's computer (already implemented)
- **Activation**: One-time process where the app validates a license key with the server
- **Verification**: Periodic check (every 30 days) to confirm license is still valid
- **Grace Period**: Number of days (14) the app continues working if verification fails due to no internet
- **Announcement**: News or notifications fetched from the server

## Requirements

### Requirement 1: Internet Connectivity Detection

**User Story:** As a school administrator, I want the app to detect internet availability, so that it can perform online operations when possible and work offline when not.

#### Acceptance Criteria

1. WHEN the app starts, THE Connectivity_Service SHALL check if the license server is reachable
2. WHEN checking connectivity, THE Connectivity_Service SHALL use a lightweight health endpoint with a 5-second timeout
3. WHEN connectivity status changes, THE Connectivity_Service SHALL notify relevant components
4. IF the server is unreachable, THEN THE Connectivity_Service SHALL allow the app to continue in offline mode

### Requirement 2: Browser-Based Activation Flow

**User Story:** As a school administrator, I want to activate my license through the website, so that I can complete payment and activation in one place.

#### Acceptance Criteria

1. WHEN the user clicks "Activate License", THE Maktab_App SHALL open the default browser with the activation URL including the machine ID as a query parameter
2. WHEN opening the activation URL, THE Maktab_App SHALL use the format: `https://maktab.af/activate?mid={machineId}`
3. WHEN the user returns to the app with a license key, THE Maktab_App SHALL provide an input field to enter the received license key
4. WHEN a license key is entered, THE Maktab_App SHALL validate the key format before sending to server

### Requirement 3: License Activation API Integration

**User Story:** As a school administrator, I want my license key validated online, so that it is securely bound to my device.

#### Acceptance Criteria

1. WHEN activating a license, THE License_Client SHALL send a signed request to the server with machineId, licenseKey, and appVersion
2. WHEN the server returns success, THE License_Client SHALL store the license details locally (licenseKey, licenseType, expiresAt, schoolName)
3. WHEN the server returns success, THE License_Client SHALL store the lastVerifiedAt timestamp
4. IF the server returns an error, THEN THE License_Client SHALL display the Farsi error message to the user
5. IF the network request fails, THEN THE License_Client SHALL display a connection error and allow retry

### Requirement 4: Periodic License Verification

**User Story:** As a software vendor, I want the app to periodically verify licenses, so that revoked licenses stop working.

#### Acceptance Criteria

1. WHEN the app starts and internet is available, THE Verification_Service SHALL check if verification is needed (more than 30 days since lastVerifiedAt)
2. WHEN verification is needed, THE Verification_Service SHALL send a signed request to the server
3. WHEN verification succeeds, THE Verification_Service SHALL update lastVerifiedAt and store any returned announcements
4. WHEN verification returns 'revoked' or 'expired', THE Verification_Service SHALL block the app and display the reason
5. IF verification fails due to network error, THEN THE Verification_Service SHALL start the grace period countdown

### Requirement 5: Offline Grace Period

**User Story:** As a school administrator with unreliable internet, I want the app to continue working offline for a reasonable period, so that my school operations are not disrupted.

#### Acceptance Criteria

1. WHEN verification fails due to network error, THE Grace_Period_Manager SHALL allow continued usage for 14 days
2. WHILE in grace period, THE Grace_Period_Manager SHALL display a warning with days remaining
3. WHEN the grace period expires, THE Grace_Period_Manager SHALL block the app until online verification succeeds
4. WHEN verification succeeds after grace period, THE Grace_Period_Manager SHALL reset the grace period state
5. IF the license has expired (expiresAt in past), THEN THE App SHALL block usage regardless of grace period

### Requirement 6: Announcement System

**User Story:** As a school administrator, I want to receive announcements from the developers, so that I stay informed about updates and news.

#### Acceptance Criteria

1. WHEN verification succeeds, THE Announcement_Handler SHALL store any returned announcements locally
2. WHEN the app starts with unread announcements, THE Announcement_Handler SHALL display them in a notification area
3. WHEN the user dismisses an announcement, THE Announcement_Handler SHALL mark it as read locally
4. WHEN displaying announcements, THE Announcement_Handler SHALL show priority-based styling (normal, high, urgent)

### Requirement 7: Update Checker

**User Story:** As a school administrator, I want to be notified about app updates, so that I can download the latest version.

#### Acceptance Criteria

1. WHEN verification succeeds, THE Update_Checker SHALL compare the current version with the server's latest version
2. WHEN an update is available, THE Update_Checker SHALL display a notification with version and changelog
3. WHEN the user clicks the update notification, THE Update_Checker SHALL open the download URL in the browser
4. IF the update is marked as required, THEN THE Update_Checker SHALL show a blocking prompt until the user acknowledges

### Requirement 8: Feedback System

**User Story:** As a school administrator, I want to send feedback to the developers, so that I can report issues or suggest features.

#### Acceptance Criteria

1. WHEN the user submits feedback, THE Feedback_Service SHALL send the message to the server with machineId and contact info
2. WHEN feedback is submitted successfully, THE Feedback_Service SHALL display a confirmation message
3. IF feedback submission fails, THEN THE Feedback_Service SHALL save it locally for retry when online

### Requirement 9: Request Signing

**User Story:** As a software vendor, I want all API requests to be signed, so that they cannot be forged.

#### Acceptance Criteria

1. WHEN sending any API request, THE Signature_Service SHALL include an HMAC-SHA256 signature of the payload
2. WHEN receiving any API response, THE Signature_Service SHALL verify the response signature before processing
3. IF response signature is invalid, THEN THE Signature_Service SHALL reject the response and log the event

### Requirement 10: Local License Storage

**User Story:** As a school administrator, I want my license to be stored securely, so that it persists across app restarts.

#### Acceptance Criteria

1. WHEN storing license data, THE Storage_Service SHALL encrypt sensitive fields using a machine-specific key
2. WHEN the app starts, THE Storage_Service SHALL load and decrypt the stored license data
3. WHEN license data is corrupted or missing, THE Storage_Service SHALL require re-activation
