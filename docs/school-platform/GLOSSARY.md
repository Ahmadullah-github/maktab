# Glossary and Open Terminology

**Status:** Working vocabulary; terms marked TBD require stakeholder confirmation  
**Last updated:** 2026-08-03

## 1. Platform terms

| Term | Meaning in this documentation |
|---|---|
| Platform | The complete cloud service, web portals, Electron client, workers, databases, and supported integrations |
| Tenant organization | One contracted school customer and the root security/data-isolation boundary |
| School unit | A campus, branch, course center, or operational unit inside a tenant; exact types remain configurable |
| SaaS | Shared, centrally operated software service with logical tenant isolation |
| Contract | Commercial agreement with one tenant, including dates, modules, limits, support, and pricing references |
| Entitlement | A contract-derived feature/module/limit made available to a tenant |
| Permission | An action a role may perform, such as issuing a receipt or submitting attendance |
| Scope | The records to which a permission applies, such as one class, unit, store, or cashbox |
| Relationship rule | Access based on a domain relationship, such as guardian-to-child or teacher-to-class |
| System of record | The authoritative source whose committed state wins; cloud PostgreSQL for online business data |
| Local workspace | Electron SQLite data used for offline timetable input/drafts/cache, not shared ERP truth |
| Raw biometric event | Immutable event received from a device/connector before identity/rule projection |
| Projection | A derived interpretation, such as present/late or a worked session, which can be corrected with history |
| Posted transaction | Final accounting entry that cannot be edited/deleted and must be reversed/adjusted |
| Outbox | Transactionally recorded work to be delivered asynchronously after business state commits |
| Idempotency key | Client/connector command identifier that makes safe retries return one logical result |

## 2. School roles collected so far

| Dari/Persian label | Working English label | Notes |
|---|---|---|
| ولی شاگرد | Guardian | Relationship-limited access to linked student(s) |
| استاد | Teacher | Scoped to assigned classes/subjects/responsibilities |
| تحویل‌دار | Storekeeper / custodian | Inventory, books, uniforms, entrusted items |
| آمر نظم | Discipline officer | Discipline cases and related reports |
| پذیرش / معلومات | Admissions / information officer | Applicant/student intake and information |
| مدیر اداری | Administrative manager | Administrative operations; not automatically finance approver |
| مدیر مالی | Finance manager | Finance visibility/actions according to segregation policy |
| مدیر کورس | Course manager | Course-center and course lifecycle scope |
| سرمعلم | Head teacher | Academic oversight, results, attendance, exams, scheduling |
| مدیر | School manager/principal | Broad school oversight; explicit permissions still required |
| معاون | Deputy | Delegated scope defined per school |
| رئیس | President/head | Highest school leadership template, not platform/vendor superuser |

Exact translations and legal responsibility vary by school and must be validated during onboarding.

## 3. Terms awaiting domain samples

### شقه — TBD

Mentioned in relation to entering student marks and automatically creating related tables. Required evidence:

- one blank and one completed real form;
- grade/year applicability;
- rows, columns, calculations, signatures, locking/correction rules;
- who creates, enters, approves, prints, and receives it;
- whether it is an official Ministry format and how versions change.

No database table or UI should be named solely from an assumed translation until this is resolved.

### سه پارچه — TBD

Mentioned as `سه پارچه رفت` and `سه پارچه آمد`. It may relate to student transfer/movement documentation, but that is only a hypothesis. Required evidence:

- outgoing and incoming document samples;
- initiating and receiving parties;
- student/enrollment state transitions;
- document numbering, approvals, attachments, and retention;
- whether a transfer crosses class, school unit, tenant, or external school.

### کورس — TBD boundary

The collected requirements describe courses with separate registration, attendance, teachers, books, fees, arrears, salaries, sales, reports, closure, and balance. Confirm whether a `کورس` is:

- a short course inside the same school;
- a separate course center/branch;
- an academic program/cohort;
- a commercially separate operation;
- or multiple configurable types.

This choice affects organizational hierarchy, accounting dimensions, calendars, enrollment, and reporting.

### سویه — TBD

Mentioned with temporary students and assessment/result tables. Confirm whether it means placement level, proficiency level, temporary enrollment classification, equivalency, or another official status. Obtain the decision rules and report samples.

## 4. Other terminology to confirm

| Term/question | Required decision |
|---|---|
| صنف / شعبه / گروپ | Distinguish grade level, physical class, section, cohort, and grouping |
| سرمعلمیت | Confirm department boundary and delegated authority by school type |
| تحویل‌خانه / تحویل‌داری | Distinguish store, custody, library, warehouse, and asset responsibility |
| باقیات | Define arrears aging, opening balances, write-off, family allocation, and reporting |
| بیلانس | Identify whether each report means trial balance, account balance, profit/loss, cash balance, or another local form |
| بلنگ | Source text is unclear; obtain correct spelling, form, and meaning |
| محرومین | Define academic/attendance eligibility rules, approval, appeal, and publication |
| کارت سوانح شاگرد | Define whether this is incident/history/welfare/identity card and its privacy level |
| دایری شاگرد | Obtain diary format, author, recipient, frequency, attachments, and acknowledgement behavior |
| رشد ذهنی | Define ethical rubric, qualified authors, evidence, guardian visibility, appeal, and whether this feature should exist |
| حاضری صبح / رفت‌وآمد | Define school-day sessions, grace periods, late/leave status, and entry/exit device direction |
| فیس فامیلی | Define how one payment allocates among siblings, charges, discounts, and receipts |

## 5. Terminology governance

- Store stable internal codes separately from translated labels.
- Maintain Dari/Persian, Pashto, and English product terminology with school-approved wording.
- Never let a translation choice determine the data model without workflow confirmation.
- Version official templates and preserve which version produced a historical record.
- Link every resolved term to sample artifacts, business owner, approval date, and impacted requirement IDs.

