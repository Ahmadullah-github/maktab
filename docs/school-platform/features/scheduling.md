# Timetable and Scheduling

**Module prefix:** `SCH`  
**Current status:** Existing advanced offline subsystem; cloud integration not implemented  
**Primary owners:** Head teacher, timetable administrator

## Objective

Preserve the existing offline timetable generator while integrating it safely with authoritative cloud academic data and centrally published schedules.

## Existing capability to preserve

The repository already contains a React/Vite scheduling UI, local Express/TypeORM API, SQLite database, packaged Python solver, Electron lifecycle, generation status, schedule storage, editing/swaps, views, and export. This is the implementation baseline, not a blank-slate rewrite.

The local scheduling input now uses the revisioned school-owned plan in
[School Curriculum](school-curriculum.md). The Afghanistan curriculum is an optional renderer/API
template only; the solver consumes ordinary school-defined subjects and class requirements.

## Requirements

| ID | Requirement |
|---|---|
| SCH-001 | Build a cloud-authoritative scheduling input from academic years, classes, subjects, teachers, rooms, periods, assignments, and constraints. |
| SCH-002 | Download an immutable, schema-versioned snapshot with revision, checksums, tenant/year context, and generated time. |
| SCH-003 | Store snapshots and schedule drafts locally in Electron SQLite for offline use. |
| SCH-004 | Run the Python solver and local validation without internet. |
| SCH-005 | Permit local manual editing/swaps and preserve draft history/recovery without making them official. |
| SCH-006 | Upload a candidate with source revision, client/app/solver versions, validation summary, and idempotency key. |
| SCH-007 | Detect stale inputs and explain changed teachers/classes/assignments/constraints rather than silently overwriting. |
| SCH-008 | Validate conflicts, entitlement, permission, academic locks, and schema compatibility in Django before acceptance/publication. |
| SCH-009 | Manage timetable lifecycle (`draft`, `review`, `published`, `superseded`) with approval and audit. |
| SCH-010 | Expose published teacher/class/room timetables to authorized portals and A4/PDF export. |
| SCH-011 | Support safe Electron/API backward compatibility and migration of local workspaces. |
| SCH-012 | Keep cloud and local responsibilities explicit; arbitrary ERP CRUD is not synchronized through SQLite. |

## Offline synchronization contract

```text
Cloud revision R1
  → versioned snapshot downloaded
  → local solve/edit creates candidate C1
  → upload C1 referencing R1
  → server compares current revision
      ├── still R1: validate and accept for review
      └── now R2: reject as stale with structured differences
  → authorized publication creates official timetable Vn
```

Conflict resolution is explicit: rebase by downloading a new snapshot and regenerating/editing, or an authorized reviewer accepts a narrowly defined safe difference. No generic last-write-wins.

## Core entities/artifacts

Cloud: `SchedulingSnapshot`, `SchedulingRevision`, `ScheduleCandidate`, `ValidationRun`, `TimetableVersion`, `TimetableEntry`, `Publication`. Local: snapshot cache, solver inputs/output, draft/version metadata, unsynced candidate queue, diagnostic bundle.

## Invariants

- Tenant/year/unit context is embedded and verified, not selected only in UI.
- Published timetable entries reference valid cloud academic entities and one version.
- Only one official active published version per defined scope/effective date unless policy explicitly supports variants.
- Local failure cannot damage a published version.
- Upload retry cannot create duplicate candidates/publications.
- Solver status and errors do not expose sensitive paths or credentials.

## Reports and views

Teacher/class/room timetables; workload and free periods; conflicts/constraint violations; publication history; schedule changes between versions; solver diagnostics; A4 and spreadsheet exports.

## Acceptance criteria

- A user can disconnect after snapshot download, generate/review a schedule, restart Electron, and retain the draft.
- Upload based on a changed revision is blocked with actionable differences.
- Upload retry yields one candidate.
- Only an authorized reviewer/publisher can make portal-visible changes.
- Teacher portal never displays an unapproved local draft.
- Current scheduling regression tests continue to pass across the cloud integration.
- School curriculum changes invalidate affected local timetables with a structured reason and never
  silently restore a removed template subject.
- Unsupported Electron/schema versions fail safely and preserve exportable local work.

## Dependencies and open questions

- Depends on organization, IAM, academics, audit, files/reporting, and Electron release/update design.
- Define publication approval count, effective-date changes, and emergency schedule edits.
- Define snapshot size, supported offline duration, compatibility window, and local encryption/backup policy.

## Implementation tracker

- [ ] Inventory current local entities/API/solver contracts and regression suite
- [ ] Define cloud scheduling snapshot schema and revision algorithm
- [ ] Define local/cloud ownership and migration map
- [ ] Implement Electron cloud authentication and secure context
- [ ] Implement download, local workspace, upload, idempotency, and conflict APIs
- [ ] Implement review/publication and portal read models
- [ ] Add stale/conflict/offline/restart/version compatibility tests
- [ ] Validate A4/Excel exports and RTL labels
- [ ] Pilot real timetable end to end
- [ ] Mark cloud integration Released
