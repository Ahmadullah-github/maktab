# Mobile Experience, Student Diary, and Feedback

**Module prefix:** `MOB`  
**Current status:** Discovery; responsive web/PWA is the provisional first delivery  
**Primary owners:** Product, teachers, guardians, student-welfare leadership

## Objective

Deliver phone-friendly guardian and teacher workflows for student diary reports, messages/notices, attendance/results/fees, and carefully governed feedback without prematurely committing to a separate native application.

## Product boundary

The first assumption is a responsive web/PWA experience using the same portal and Django APIs. A native mobile app is justified only if pilots demonstrate requirements that the PWA cannot meet reliably, such as provider-supported push behavior, device integrations, offline capture, or store-distribution needs.

## Requirements

| ID | Requirement |
|---|---|
| MOB-001 | Provide secure responsive guardian and teacher experiences on representative low-cost Android phones and constrained networks. |
| MOB-002 | Let assigned teachers create student diary entries with date, category, multilingual text/template, optional safe attachment, visibility, and correction history. |
| MOB-003 | Let linked guardians view received diary entries/notices and acknowledge them if required. |
| MOB-004 | Surface messages/announcements, published attendance, timetable, results, fee receipts/arrears, and other entitled portal data without duplicating source records. |
| MOB-005 | Cache only safe static/public assets by default; any protected offline-read capability requires explicit encryption, expiry, revocation, and shared-device design. |
| MOB-006 | Support notification deep links that re-authenticate and re-authorize before showing protected data. |
| MOB-007 | Protect attachments through private tenant-owned files, size/type scanning, and relationship permissions. |
| MOB-008 | Do not implement public teacher ranking or mental-growth scoring until an approved rubric, qualified author, evidence, limited visibility, correction/appeal, anti-retaliation, and retention policy exists. |
| MOB-009 | If teacher feedback is approved, separate service feedback from employment discipline/pay decisions unless a reviewed workflow explicitly connects them. |
| MOB-010 | Collect minimal product analytics without recording student content or cross-tenant identifiers. |

## Student diary workflow

Assigned teacher chooses student/class → creates draft from approved category/template → validates audience and sensitive content → publishes → outbox notifies linked guardian account → guardian opens authenticated entry → optional acknowledgement → correction adds a new version/history. A diary entry is not automatically a discipline finding, grade, or mental-health assessment.

## Core entities

`DiaryEntry`, `DiaryEntryVersion`, `DiaryCategory`, `DiaryAcknowledgement`, `FeedbackForm`, `FeedbackRubricVersion`, `FeedbackSubmission`, `FeedbackReview`, plus shared message, file, person, guardian relationship, and portal entities.

## Safety and privacy invariants

- Teacher-to-student and guardian-to-child relationships are rechecked on every view/write.
- Push/notification preview contains minimal non-sensitive text.
- Attachments are private, scanned, size-limited, and expire/revoke with authorization.
- Feedback anonymity is never promised unless technically and operationally supportable.
- Scores affecting a child or employee require transparent purpose, access, correction, and appeal.
- No psychological/mental-health conclusion is generated from casual ratings.

## Acceptance criteria

- A guardian cannot open another student's diary entry by deep-link manipulation.
- Removing/ending a guardian relationship changes future access according to retention policy.
- A diary correction preserves the original and indicates the corrected version.
- Phone workflows pass RTL, font, touch-target, accessibility, and low-bandwidth tests.
- PWA cache/logout cannot expose protected data to the next user of a shared phone.
- Ratings remain disabled until every safeguard/open policy has approval and tests.

## Open questions

- Exact diary format, categories, frequency, attachments, acknowledgement, replies, and moderation.
- Push provider availability and PWA reliability on target devices.
- Whether any protected offline read/write is genuinely required.
- Purpose, visibility, appeal, anti-bias, and expert governance for teacher/mental-growth ratings.

## Implementation tracker

- [ ] Observe teacher/guardian diary and notification practices
- [ ] Test PWA capabilities on representative devices/networks
- [ ] Approve diary content, attachment, acknowledgement, retention, and moderation policy
- [ ] Implement responsive diary and shared portal data views
- [ ] Integrate communication provider/deep links safely
- [ ] Add shared-device cache, relationship authorization, and attachment tests
- [ ] Conduct child-safety/privacy/user-acceptance review
- [ ] Decide PWA versus native based on measured gaps
- [ ] Keep feedback/ratings Deferred until governance is approved
- [ ] Mark released capabilities individually

