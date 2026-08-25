# Public Site and Authenticated Portals

**Module prefix:** `PRT`  
**Current status:** Product direction specified; detailed UX discovery pending  
**Primary owners:** Product, school administrators, teachers, guardians, employees

## Objective

Provide one responsive web entry point where anonymous visitors see public information/tutorials and authenticated users see only the operational data and actions allowed by their account, tenant, role, relationship, and contract.

## Experiences

### Public

- product/school information approved for publication;
- tutorial/video library and help content;
- login, account activation, password recovery entry;
- language selection and low-bandwidth delivery;
- no tenant operational data or public user/student directory.

### Guardian

- linked child selector if approved;
- published timetable, attendance, results, notices/diary, fee/receipt/arrears visibility according to permissions;
- contact/preferences/password management;
- teacher/mental-growth ratings excluded until safeguards are approved.

### Teacher

- own assignments/timetable;
- assigned class rosters and attendance sheet entry;
- lesson plans, mark entry, exam responsibilities, diaries/messages, and own HR/pay information as entitled;
- advanced tasks according to explicit delegation, not job title alone.

### Staff/management

- module dashboards/actions according to entitlements, permissions, scopes, and workflow state;
- Electron may host the same online UI plus local timetable/hardware/print capabilities.

## Requirements

| ID | Requirement |
|---|---|
| PRT-001 | Separate public and authenticated routes, caches, analytics, and data-fetching boundaries. |
| PRT-002 | Render responsive RTL Dari/Persian and Pashto experiences on low-cost phones/laptops and desktop/Electron. |
| PRT-003 | Build role-aware navigation from server-provided effective capabilities while APIs independently enforce access. |
| PRT-004 | Provide clear tenant/account context; teacher and guardian accounts remain separate sessions. |
| PRT-005 | Never cache personalized/tenant data publicly or leak it through page metadata, errors, URLs, or static generation. |
| PRT-006 | Support accessible forms, tables, print/download state, async job progress, and recoverable network errors. |
| PRT-007 | Provide notification center and message status appropriate to each context. |
| PRT-008 | Deliver tutorials through object storage/CDN with configurable publication and language. |
| PRT-009 | Support session/device management, password change, first-login flow, and security notices. |
| PRT-010 | Consider PWA installation/push before committing to native mobile apps. |

## Acceptance criteria

- Anonymous users cannot receive protected data from pages, APIs, caches, files, or search.
- Guardian sees only linked child data and only published/allowed records.
- Teacher cannot open unassigned class screens by URL manipulation.
- Public tutorials load independently of the operational API where possible.
- Critical workflows work at representative mobile width, RTL, keyboard, and constrained network.
- Electron online screens and browser use the same cloud authorization semantics.

## Open questions

- Is public content platform-wide, school-specific, or both; who publishes it?
- Native mobile requirements versus PWA limitations for push/offline/media.
- Guardian multi-child behavior and account/contact linking.
- Which data can be downloaded/printed by each portal role.

## Implementation tracker

- [ ] Map role-based information architecture and critical journeys
- [ ] Define public publishing model and tutorial storage
- [ ] Build authenticated shell/capability navigation and account context
- [ ] Implement teacher, guardian, and staff slices with authorization tests
- [ ] Add RTL/localization/accessibility/low-bandwidth test matrix
- [ ] Add secure cache/file/download behavior
- [ ] Evaluate PWA/push against pilot needs
- [ ] User-acceptance pilot and mark Released by portal

