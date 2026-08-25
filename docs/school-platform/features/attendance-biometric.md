# Attendance, Biometrics, and Employee Timekeeping

**Module prefix:** `ATT`  
**Current status:** Specified architecture; device/rule discovery pending  
**Primary owners:** Teachers, head teacher, HR, device operators

## Objective

Support fast manual and biometric attendance for students and full employee timekeeping while preserving immutable device evidence, explainable rules, corrections, and reliable messaging/payroll inputs.

## Requirements

| ID | Requirement |
|---|---|
| ATT-001 | Configure student attendance modes per contract/unit: manual, biometric, hybrid; morning-only or entry/exit. |
| ATT-002 | Let an assigned teacher submit a full class attendance sheet in one transaction with idempotency and roster/version validation. |
| ATT-003 | Support statuses including present, absent, late, authorized leave, sick/other approved values, with policy-defined rules. |
| ATT-004 | Register devices and connectors by tenant/site with credentials, capabilities, direction, timezone/clock, health, and mapping state. |
| ATT-005 | Ingest normalized event batches idempotently and store immutable raw events before projection. |
| ATT-006 | Map device user codes to students/employees using effective-dated tenant-owned mappings and controlled exception review. |
| ATT-007 | Detect duplicate events, clock drift, unknown identity, missing exit, exit without entry, early leave, and conflicting/manual events. |
| ATT-008 | Derive student attendance separately from raw events and allow reasoned, permissioned corrections without modifying evidence. |
| ATT-009 | Support employee arrival, departure, break start/end, shifts, worked hours, lateness, early leave, overtime, leave, duty, holiday, and missing-punch correction. |
| ATT-010 | Convert employee punches to work sessions/daily timesheets, then approval, then payroll input; never pay directly from raw events. |
| ATT-011 | Trigger optional attendance notification intents after committed projection/sheet state and track delivery separately. |
| ATT-012 | Buffer connector events during outage, retry safely, and show backlog, last-seen, drift, and unmapped-event health. |
| ATT-013 | Avoid cloud storage of fingerprint images/templates by default; store only required event/mapping metadata. |
| ATT-014 | Produce daily/monthly/student/class/employee/device/exception statistical reports. |

## Student biometric pipeline

Device local match → connector durable buffer → authenticated batch upload → immutable raw event → deduplication → identity mapping → attendance-rule projection → exception review → final attendance → optional guardian message.

Direction can come from separate entry/exit devices, configured device direction, or another certified signal. Guessing direction from alternating punches is not acceptable without an approved rule.

## Employee timekeeping pipeline

Raw punch → mapped punch → ordered work session/breaks → daily timesheet and exception calculation → employee/manager correction request → HR approval → locked payroll input. Rule/policy version is retained for explanation.

## Core entities

`AttendancePolicy`, `AttendanceSession`, `ClassAttendanceSheet`, `StudentAttendance`, `AttendanceCorrection`, `Device`, `Connector`, `DeviceCredential`, `DeviceIdentityMapping`, `DeviceRawEvent`, `EventProcessingState`, `AttendanceException`, `Shift`, `EmployeePunch`, `WorkSession`, `DailyTimesheet`, `Leave`, `TimesheetApproval`.

## Invariants and controls

- Unique tenant/device/vendor-event ID (or robust fallback fingerprint) prevents duplicate raw events.
- Original event payload/checksum and received time are immutable.
- Corrections record original projection, new state, reason, actor, approval, and linked evidence.
- Manual and biometric sources follow explicit precedence/conflict rules.
- Teacher scope is assignment-based; HR employee visibility is purpose-limited.
- Device credentials are per connector/device, revocable, rotated, and cannot access normal user APIs.
- School-local attendance date is derived using configured timezone/calendar, not connector machine date alone.

## Performance and hardware acceptance

Cloud testing must simulate morning batch bursts. Physical procurement tests must measure scans/minute, false retry behavior, device log capacity, LAN/offline operation, power recovery, clock drift, SDK/API stability, duplicate behavior, and enrollment/mapping operations for 500–1,000 students.

## Acceptance criteria

- A normal class sheet commits all valid rows or returns clear row errors without partial unknown state.
- Repeating a sheet/batch request with the same idempotency key creates no duplicates.
- Connector can remain offline, restart, reconnect, and drain its backlog in order without data loss.
- Raw event remains unchanged after a correction and both states are auditable.
- An unknown device user appears in an exception queue and is not attached to the wrong person.
- Morning load target is met and job backlog returns to normal within an agreed window.
- Payroll sees only approved time summaries for the selected period.

## Open questions

- Exact student late/absence/leave and entry/exit rules by school/shift.
- Certified device models, protocols, and enrollment ownership.
- Whether parent notification is immediate, delayed, or exception-based.
- Employee shift/overtime/leave policies and approval chain.
- Required retention period for raw events and corrections.

## Implementation tracker

- [ ] Collect attendance policies and physical traffic observations
- [ ] Certify initial device/SDK and canonical adapter contract
- [ ] Design raw event, mapping, projection, correction, and timesheet models
- [ ] Implement manual class-sheet API/UI with idempotency
- [ ] Implement connector buffer, authentication, batches, and health
- [ ] Implement rules, exceptions, correction, and approval workflows
- [ ] Integrate message outbox and approved payroll input
- [ ] Run privacy, failure-recovery, and burst load tests
- [ ] Pilot manual then biometric modes
- [ ] Mark Released by capability

