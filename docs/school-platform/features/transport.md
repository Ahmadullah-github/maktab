# Transport

**Module prefix:** `TRN`  
**Current status:** Discovery  
**Primary owners:** Transport manager, admissions, finance, authorized guardians

## Objective

Maintain safe school transport routes and rider assignments, with optional fee and attendance/communication integration, after the operational boundary is confirmed.

## Requirements

| ID | Requirement |
|---|---|
| TRN-001 | Register routes with tenant/unit, code/name, direction, schedule, capacity, status, and effective dates. |
| TRN-002 | Register ordered stops/areas, planned times, pickup/drop-off rules, and optional geographic coordinates. |
| TRN-003 | Register riders (`راکبین`) and effective route/stop/direction assignments with guardian authorization and emergency contacts. |
| TRN-004 | Support student and authorized employee riders while keeping identity in shared Person/Profile modules. |
| TRN-005 | Register vehicles, capacity, ownership/provider, documents, and drivers/assistants only if included in confirmed scope. |
| TRN-006 | Prevent assignments beyond approved capacity or flag authorized exceptions. |
| TRN-007 | Integrate transport fee plans/charges/arrears through finance rather than separate balance fields. |
| TRN-008 | Provide route/rider rosters and authorized guardian information with minimum necessary contact data. |
| TRN-009 | Support route change/cancellation notifications through communications. |
| TRN-010 | Preserve assignment history and provide route/utilization/fee reports. |

## Core entities

`Route`, `RouteVersion`, `Stop`, `RouteStop`, `RiderAssignment`, `Vehicle`, `DriverAssignment`, `TransportSchedule`, `TransportException`.

## Invariants and safety

- Rider assignment has effective dates and one defined pickup/drop-off arrangement per applicable session unless approved otherwise.
- Drivers/transport staff see only the roster/contact/safety data needed for the route.
- Route history is retained when stops/times change.
- Capacity and vehicle/document expiry warnings are visible before operation.
- No real-time child tracking is included without a separate privacy/security design.

## Reports

Route/stop/rider lists; capacity/utilization; student transport assignment; additions/removals; transport fees/arrears through finance; vehicle/driver document expiry if included.

## Acceptance criteria

- A route change creates a new effective version without rewriting old attendance/fee history.
- Unauthorized guardians cannot view other riders or routes beyond allowed public information.
- Capacity conflicts are deterministic and require permission/reason to override.
- Rider and finance counts reconcile for the selected effective date/period.

## Open questions

- Exact meaning/fields of `راکبین` and whether vehicles/drivers/live tracking are in scope.
- One-way versus two-way assignment, stops, safety handover, route attendance, and guardian consent.
- Transport fee rules and required reports.

## Implementation tracker

- [ ] Observe transport workflow and collect rosters/forms
- [ ] Approve route/stop/rider/vehicle boundary and privacy rules
- [ ] Design effective-dated assignments and capacity rules
- [ ] Implement route/rider management and scoped rosters
- [ ] Integrate finance and communications
- [ ] Add safety/privacy/capacity tests
- [ ] Pilot and reconcile routes/riders
- [ ] Mark Released

