# Implementation Plan

## Phase 1: Core Infrastructure

- [ ] 1. Set up License Server Configuration
  - [ ] 1.1 Create licenseServer.ts config file
    - Define BASE_URL, endpoints, timeouts, intervals
    - Add environment variable support for LICENSE_SERVER_URL
    - Add LICENSE_SECRET_KEY from environment
    - _Requirements: 3.1, 4.1, 5.1_
  - [ ] 1.2 Create database migrations for new tables
    - Add online_license table
    - Add announcements_cache table
    - Add feedback_queue table
    - _Requirements: 3.2, 6.1, 8.3_

- [ ] 2. Implement Signature Service
  - [ ] 2.1 Create signatureService.ts
    - Implement signRequest() using HMAC-SHA256
    - Implement verifyResponse() for incoming responses
    - Include timestamp in signature calculation
    - _Requirements: 9.1, 9.2_
  - [ ] 2.2 Write property test for request signature
    - **Property 8: Request Signature Validity**
    - **Validates: Requirements 9.1**
  - [ ] 2.3 Write property test for response verification
    - **Property 9: Response Signature Verification**
    - **Validates: Requirements 9.2**

- [ ] 3. Implement Connectivity Service
  - [ ] 3.1 Create connectivityService.ts
    - Implement isOnline() with health endpoint check
    - Implement getStatus() for cached status
    - Add 5-second timeout
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 3.2 Write property test for connectivity timeout
    - **Property 1: Connectivity Check Timeout**
    - **Validates: Requirements 1.2**

- [ ] 4. Checkpoint - Verify core infrastructure works
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: License Client

- [ ] 5. Implement Online License Client
  - [ ] 5.1 Create onlineLicenseClient.ts
    - Implement HTTP client with retry logic
    - Add request signing to all outgoing requests
    - Add response signature verification
    - _Requirements: 3.1, 9.1, 9.2_
  - [ ] 5.2 Implement openActivationPage()
    - Use Electron shell.openExternal()
    - Format URL with machine ID query parameter
    - _Requirements: 2.1, 2.2_
  - [ ] 5.3 Write property test for activation URL format
    - **Property 2: Activation URL Format**
    - **Validates: Requirements 2.1, 2.2**
  - [ ] 5.4 Implement activate() method
    - Send signed activation request
    - Handle success/error responses
    - Store license data on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ] 5.5 Write property test for license storage round trip
    - **Property 3: License Storage Round Trip**
    - **Validates: Requirements 3.2, 10.2**
  - [ ] 5.6 Implement verify() method
    - Send signed verification request
    - Handle all response statuses (valid, expired, revoked)
    - Update lastVerifiedAt on success
    - _Requirements: 4.2, 4.3, 4.4_

- [ ] 6. Checkpoint - Verify license client works
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Verification & Grace Period

- [ ] 7. Implement Verification Service
  - [ ] 7.1 Create verificationService.ts
    - Implement needsVerification() with 30-day check
    - Implement performVerification() calling license client
    - Implement getDaysSinceLastVerification()
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 7.2 Write property test for verification timing
    - **Property 4: Verification Timing**
    - **Validates: Requirements 4.1**

- [ ] 8. Implement Grace Period Manager
  - [ ] 8.1 Create gracePeriodManager.ts
    - Implement isInGracePeriod()
    - Implement getGraceDaysRemaining() with 14-day limit
    - Implement shouldBlockApp() checking all conditions
    - Implement startGracePeriod() and resetGracePeriod()
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 8.2 Write property test for grace period calculation
    - **Property 5: Grace Period Calculation**
    - **Validates: Requirements 5.1, 5.2**
  - [ ] 8.3 Write property test for grace period blocking
    - **Property 6: Grace Period Blocking**
    - **Validates: Requirements 5.3**
  - [ ] 8.4 Write property test for expired license blocking
    - **Property 7: Expired License Blocking**
    - **Validates: Requirements 5.5**
  - [ ] 8.5 Implement getLicenseStatus()
    - Return comprehensive status object
    - Include all blocking conditions
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 9. Checkpoint - Verify verification and grace period work
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Announcements & Updates

- [ ] 10. Implement Announcement Handler
  - [ ] 10.1 Create announcementHandler.ts
    - Implement storeAnnouncements() saving to local DB
    - Implement getUnreadAnnouncements() filtering read ones
    - Implement markAsRead() updating local DB
    - Implement clearExpired() removing old announcements
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ] 10.2 Write property test for announcement read state
    - **Property 10: Announcement Read State**
    - **Validates: Requirements 6.3**

- [ ] 11. Implement Update Checker
  - [ ] 11.1 Create updateChecker.ts
    - Implement checkForUpdates() comparing versions
    - Implement openDownloadPage() using shell.openExternal()
    - Implement getCurrentVersion() from package.json
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Implement Feedback Service
  - [ ] 12.1 Create feedbackService.ts
    - Implement submitFeedback() sending to server
    - Implement queueFeedback() for offline storage
    - Implement sendQueuedFeedback() for retry
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 13. Checkpoint - Verify announcements, updates, and feedback work
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: UI Integration

- [ ] 14. Create Activation UI Components
  - [ ] 14.1 Add "Activate Online" button to license screen
    - Call openActivationPage() with machine ID
    - Show machine ID for reference
    - _Requirements: 2.1, 2.3_
  - [ ] 14.2 Add license key input form
    - Input field for license key
    - Validate format before submission
    - Show loading state during activation
    - _Requirements: 2.3, 2.4, 3.4_
  - [ ] 14.3 Handle activation responses
    - Show success message with license details
    - Show error messages in Farsi
    - Add retry button on network error
    - _Requirements: 3.4, 3.5_

- [ ] 15. Create License Status Display
  - [ ] 15.1 Update license status component
    - Show online license info (type, expiry, days remaining)
    - Show grace period warning if applicable
    - Show verification status
    - _Requirements: 5.2_
  - [ ] 15.2 Create blocked screen
    - Show block reason in Farsi
    - Show contact info for support
    - Show "Verify Now" button if verification needed
    - _Requirements: 4.4, 5.3_

- [ ] 16. Create Announcement Display
  - [ ] 16.1 Add announcement notification area
    - Show unread announcements on app start
    - Priority-based styling (normal, high, urgent)
    - Dismiss button to mark as read
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 17. Create Update Notification
  - [ ] 17.1 Add update notification component
    - Show when update available
    - Display version and changelog summary
    - "Download" button opens browser
    - _Requirements: 7.2, 7.3_
  - [ ] 17.2 Add required update blocking
    - Show blocking modal for required updates
    - Only allow "Download" action
    - _Requirements: 7.4_

- [ ] 18. Create Feedback Form
  - [ ] 18.1 Add feedback/contact form
    - Subject, message, type selector
    - Contact info fields
    - Submit button with loading state
    - _Requirements: 8.1, 8.2_

- [ ] 19. Checkpoint - Verify UI integration works
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: App Startup Integration

- [ ] 20. Integrate with App Initialization
  - [ ] 20.1 Add license check to app startup
    - Check local license status first
    - Check if verification needed
    - Trigger verification if online and needed
    - _Requirements: 4.1, 5.5_
  - [ ] 20.2 Add connectivity check on startup
    - Check if server reachable
    - Set online/offline mode
    - _Requirements: 1.1, 1.4_
  - [ ] 20.3 Add announcement fetch on startup
    - Fetch announcements if online
    - Display unread announcements
    - _Requirements: 6.1, 6.2_
  - [ ] 20.4 Add update check on startup
    - Check for updates if online
    - Show notification if available
    - _Requirements: 7.1, 7.2_

- [ ] 21. Add Periodic Background Checks
  - [ ] 21.1 Add verification check on app focus
    - Check if verification needed when app gains focus
    - Trigger background verification
    - _Requirements: 4.1_
  - [ ] 21.2 Add queued feedback sender
    - Send queued feedback when online
    - _Requirements: 8.3_

- [ ] 22. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
