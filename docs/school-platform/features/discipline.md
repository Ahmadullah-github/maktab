# Discipline and Student Welfare

**Module prefix:** `DSP`  
**Current status:** Discovery  
**Primary owners:** Discipline officer, head teacher, authorized HR leadership

## Objective

Record student and employee/teacher discipline matters consistently, protect confidential information, support fair workflows, and produce authorized reports without turning allegations into permanent unreviewed labels.

## Requirements

| ID | Requirement |
|---|---|
| DSP-001 | Configure discipline/incident types, severity, applicable person type, required evidence, default workflow, and reporting classification. |
| DSP-002 | Record student incidents with date/location, reporter, involved parties, allegation/facts, witnesses, evidence, and confidentiality. |
| DSP-003 | Record teacher/employee cases with HR-appropriate separation and visibility. |
| DSP-004 | Use lifecycle states such as reported, triaged, under review, substantiated/unsubstantiated, action proposed, approved, closed, appealed. |
| DSP-005 | Separate allegation, investigation findings, decision, action, and appeal; retain correction/history. |
| DSP-006 | Record restorative/support actions, warnings, sanctions, referrals, follow-up, and guardian communication where policy allows. |
| DSP-007 | Restrict access by purpose, case assignment, leadership role, and subject relationship; normal teachers do not browse all cases. |
| DSP-008 | Produce individual, class, teacher/employee, date, severity, status, and type reports using minimum necessary detail. |
| DSP-009 | Define retention, sealing/archival, export, and disclosure rules for minors and employees. |
| DSP-010 | Prevent discipline indicators from automatically changing grades, fees, payroll, or attendance without an explicit approved policy/workflow. |

## Core entities

`DisciplineType`, `Case`, `CaseParty`, `CaseAssignment`, `Allegation`, `EvidenceAttachment`, `Finding`, `Action`, `Approval`, `Appeal`, `FollowUp`, `DisclosureRecord`.

## Invariants and safeguards

- A report is not a finding.
- Confidential attachments use private object storage and access audit.
- Case edits retain history; closure does not erase evidence.
- Employee cases and student cases have different permission/retention policies.
- Aggregated reports avoid unnecessary names and small-group re-identification.
- “Mental growth”/behavior scoring is excluded until an ethical, evidence, appeal, visibility, and retention policy is approved.

## Acceptance criteria

- Unauthorized teachers/guardians cannot infer a case through IDs, search, counts, exports, or files.
- Case timeline identifies every change, actor, reason, and decision state.
- Unsubstantiated allegations are distinguishable from confirmed outcomes in all views/reports.
- Appeal/correction retains prior decision and authorized notifications.
- Class/type reports reconcile to cases and apply privacy thresholds where required.

## Open questions

- School discipline policy, action/approval matrix, guardian notification, appeal, and retention.
- Meaning/content of `کارت سوانح شاگرد` and whether it belongs here.
- Which employee matters are discipline versus HR performance/grievance.
- Legal/ethical boundaries for child behavior and mental-development ratings.

## Implementation tracker

- [ ] Collect policy, case, incident-card, and report samples
- [ ] Complete child-safety/privacy review
- [ ] Define case lifecycle, confidentiality, appeals, and retention
- [ ] Implement types, cases, evidence, findings, actions, and follow-up
- [ ] Implement relationship/case-assignment authorization
- [ ] Add private file and disclosure audit controls
- [ ] Build privacy-safe report catalog
- [ ] Pilot with trained authorized staff
- [ ] Mark Released

