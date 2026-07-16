---
type: "query"
date: "2026-07-16T17:32:10.709513+00:00"
question: "so then solve it please"
contributor: "graphify"
outcome: "useful"
source_nodes: ["TeacherBulkImportDialog()", "calculateMaxPeriodsPerWeek()", "Teacher"]
---

# Q: so then solve it please

## Answer

Expanded from original query via vocab: [teacher, teachers, bulk, import, category, config, period, periods, validation, test, school, drawer]. Implemented the teacher bulk-import fix. TeacherService now validates weekly, daily, consecutive, and unavailable-slot boundaries using buildCanonicalPeriodConfiguration, so category-specific period maps are authoritative. Bulk import loads school config once per distinct school rather than once per teacher. The web importer no longer supplies a hard-coded 35 when an Excel workload is blank, validates finite integer workloads against the loaded school calendar, and refuses validation until configuration exists. Added web regression tests for dynamic 34-period defaults and over-capacity normalization, plus an API integration test reproducing Middle=32 and High=34: 34 succeeds and 35 fails with calendar (34). Verification: API full suite 20/20, web teacher suite 5/5, API build, web type-check, ESLint, and diff check all pass.

## Outcome

- Signal: useful

## Source Nodes

- TeacherBulkImportDialog()
- calculateMaxPeriodsPerWeek()
- Teacher