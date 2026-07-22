---
type: "query"
date: "2026-07-22T12:29:14.670684+00:00"
question: "Implement the plan."
contributor: "graphify"
outcome: "useful"
source_nodes: ["MainLayout", "SchoolSettingsPage", "SchoolConfig", "Header", "Sidebar"]
---

# Q: Implement the plan.

## Answer

Expanded from the earlier school profile query via vocab: [school, profile, settings, layout, date, calendar, export, migration]. Implemented singleton SchoolProfile persistence and revision-safe API routes, optional validated logo storage with a School icon fallback, first-run setup gating, shared layout branding, profile settings metadata, centralized Gregorian and Solar Hijri presentation with calculated Lunar Hijri secondary display, an ISO-backed localized date field, branded calendar-aware PDF and Excel exports, and focused tests. MainLayout now gates on SchoolProfile; Header and Sidebar render SchoolBrand; SchoolSettingsPage owns profile editing while SchoolConfig remains scheduling configuration.

## Outcome

- Signal: useful

## Source Nodes

- MainLayout
- SchoolSettingsPage
- SchoolConfig
- Header
- Sidebar