# Organizations, Contracts, and Entitlements

**Module prefix:** `ORG`  
**Current status:** Specified at platform level; organizational terminology remains in Discovery  
**Primary owners:** Vendor operations, tenant leadership, platform administration

## Objective

Provision each contracted school as an isolated tenant, describe its internal units, and enforce purchased modules and limits without mixing commercial entitlement with individual authorization.

## Requirements

| ID | Requirement |
|---|---|
| ORG-001 | Create a tenant organization with immutable internal ID, legal/display names, languages, timezone, status, and primary contacts. |
| ORG-002 | Model campuses, branches, course centers, departments, and other school units as effective-dated tenant-owned structures. |
| ORG-003 | Record each school's own contract, dates, tier, modules, limits, hardware arrangement references, and support/SLA metadata. |
| ORG-004 | Maintain subscription lifecycle (`trial`, `active`, `grace`, `suspended`, `ended`) with explicit allowed behavior in each state. |
| ORG-005 | Expose entitlements for modules, user/student/device limits, attendance modes, messaging/storage quotas, finance approval modes, and advanced reports. |
| ORG-006 | Evaluate entitlements server-side on every protected capability; frontend navigation reflects but does not enforce them. |
| ORG-007 | Track measured usage and provide warnings before hard limits; never corrupt an in-progress financial/attendance transaction because a quota changes. |
| ORG-008 | Support tenant branding, document headers, contact details, locale, timezone, currency, academic defaults, and numbered-document settings. |
| ORG-009 | Provide vendor-controlled onboarding, activation, suspension, renewal, expansion, and offboarding workflows with complete audit history. |
| ORG-010 | Export a tenant's data and documents according to contract/retention policy without exposing other tenants. |
| ORG-011 | Keep hardware purchase/maintenance commercial records separate while linking enabled integration/device allowances. |
| ORG-012 | Reserve dedicated database/deployment as a future premium topology without changing domain semantics. |

## Main workflows

### Onboard a school

1. Vendor operator records approved contract metadata.
2. System provisions tenant, initial school unit, subscription, entitlements, locale, and safe defaults.
3. A maximum initial set of authorized tenant superusers receives temporary accounts.
4. Operator runs isolation/configuration checks and records onboarding acceptance.
5. Tenant becomes active; all further setup is attributed to tenant users.

### Change a contract

Changes are effective-dated and audited. Upgrades may enable immediately; downgrades first report impacted usage/data. Disabling a module hides new operation but does not delete records. Read/export behavior after suspension is a contract policy, not an ad hoc UI decision.

## Core entities

`TenantOrganization`, `SchoolUnit`, `UnitType`, `Contract`, `ContractVersion`, `Subscription`, `Plan`, `EntitlementDefinition`, `TenantEntitlement`, `UsageCounter`, `TenantSetting`, `BrandingProfile`, `OnboardingChecklist`.

## Invariants and controls

- One record belongs to one tenant; moving business records between tenants is a controlled migration, never normal editing.
- Entitlement keys are stable and versioned; unknown keys fail closed for writes.
- Contract history is never overwritten.
- Vendor and tenant administrative roles are separate security realms.
- A tenant superuser cannot raise its own contract limits or activate unpaid modules.
- Suspension does not destroy data or invalidate statutory retention.

## Reports and operations

- tenant onboarding/completion report;
- active/expiring/suspended contract list;
- entitlement and usage report;
- user/student/device/storage/message quota report;
- configuration change history;
- tenant export/offboarding status.

## Acceptance criteria

- Two tenants can use identical local identifiers/names without collision.
- A user and background job from tenant A cannot access tenant B.
- Removing an entitlement prevents its protected writes but preserves authorized history/export.
- A plan change records old/new values, effective date, actor, reason, and affected limits.
- Usage warnings and hard limits are deterministic and concurrency-safe.
- Vendor support actions are time-bounded and audited.

## Dependencies and open questions

- Depends on identity, audit, job, storage, and deployment foundations.
- Resolve the exact school-unit hierarchy and contract suspension/export policy.
- Define sold plan names, limits, SLA, retention, and premium isolation terms.

## Implementation tracker

- [ ] Approve organization/unit vocabulary and sample structures
- [ ] Design tenant/contract/entitlement schema and effective dating
- [ ] Define entitlement catalog and enforcement API
- [ ] Implement onboarding and vendor support controls
- [ ] Implement usage counters, quota warnings, and concurrency tests
- [ ] Add tenant isolation test harness
- [ ] Add configuration/branding/document settings
- [ ] Add offboarding/export/retention runbook
- [ ] Pilot and mark Released

