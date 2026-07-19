---
type: "query"
date: "2026-07-18T07:12:26.420465+00:00"
question: "Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx,packages/web/src/features/school-settings/hooks/useSchoolSettings.ts,packages/api/src/services/assignmentCommand.service.ts,packages/api/src/services/assignmentProjection.service.ts,packages/api/src/routes/assignment.routes.ts"]
---

# Q: Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?

## Answer

The API rejects the assignment because it projects Ahmad from 18 to 24 periods while its effective-capacity algorithm returns 22. Subject 44 is a primary capability, so teachability is not the problem. The UI independently shows 18/30 by subtracting four unavailable slots from 34 and does not apply maxConsecutivePeriods. The API applies maxConsecutivePeriods=2 as a weekly capacity deduction, turning five six-period days into four capacity each and Thursday into two, yielding 22. It also ignores categoryPeriodsMap unless dynamicPeriodsEnabled is true. This creates an inconsistent and overly restrictive workload calculation between UI and API.

## Outcome

- Signal: useful

## Source Nodes

- packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx,packages/web/src/features/school-settings/hooks/useSchoolSettings.ts,packages/api/src/services/assignmentCommand.service.ts,packages/api/src/services/assignmentProjection.service.ts,packages/api/src/routes/assignment.routes.ts