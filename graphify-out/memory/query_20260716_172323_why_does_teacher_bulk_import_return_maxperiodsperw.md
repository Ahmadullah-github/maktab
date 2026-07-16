---
type: "query"
date: "2026-07-16T17:23:23.202195+00:00"
question: "Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["TeacherBulkImportDialog()", "calculateMaxPeriodsPerWeek()", "Teacher"]
---

# Q: Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?

## Answer

Expanded from original query via vocab: [teacher, teachers, bulk, import, drawer, validation, max, periods, week, school]. The active school config enables category periods: Middle totals 32 periods, while High totals 34 because Thursday has 4 periods. The web bulk-import hook uses calculateMaxPeriodsPerWeek, which respects category periods and therefore supplies 34 for quick/paste imports. TeacherService.validateCalendarConstraints ignores categoryPeriodsEnabled/categoryPeriodsMap and calculates only the base dynamic map, totaling 32, so it rejects the drawer payload. The 21 cache messages are one config lookup per teacher inside Promise.all; schoolId null is the default school scope, not this failure. A secondary bug is the hook's hard-coded fallback/Excel default of 35, which can also exceed the configured calendar. Use buildCanonicalPeriodConfiguration in the API, remove hard-coded import limits, and wait for school config before importing.

## Outcome

- Signal: useful

## Source Nodes

- TeacherBulkImportDialog()
- calculateMaxPeriodsPerWeek()
- Teacher