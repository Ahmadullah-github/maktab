## ADR-002: Split-Teaching Default Policy

- Status: Accepted
- Date: 2026-04-14
- Owners: Assignments domain, Classes feature, Solver integration

### Context

Parts of the current UI already model multi-teacher assignment, while parts of
the backend still assume one teacher per class-subject. Locking the schema to
single-teacher assignment would force another migration later, but allowing
unconstrained multi-teacher assignment would weaken the default business rules
and make validation less predictable.

### Decision

The canonical schema will support split teaching, but split teaching is disabled
by default.

The policy is:

1. Every `class_subject_requirement` carries `allow_split_assignment`.
2. `allow_split_assignment` defaults to `false`.
3. When `allow_split_assignment = false`, only one active assignment may exist
   for that requirement.
4. When `allow_split_assignment = true`, multiple teachers may be assigned to
   the same requirement.
5. The sum of active `assigned_periods_per_week` values must never exceed the
   requirement's `required_periods_per_week`.
6. Solver-created rows must obey the same split rules as manual rows.

### Consequences

- The default UX remains effectively single-teacher assignment.
- The schema does not need to change when intentional team-teaching is enabled.
- Projection endpoints must surface both `allowSplitAssignment` and remaining
  required periods so the UI can explain why a second assignment is accepted or
  rejected.
- Validation rules must live in the canonical assignment command service, not in
  scattered route handlers or client fallbacks.

### Rejected Alternatives

- Single-teacher-only schema
  - Rejected because it makes future split-teaching a schema migration instead
    of a policy change.
- Always-on split teaching
  - Rejected because it weakens the default invariant and makes accidental
    over-assignment easier.
