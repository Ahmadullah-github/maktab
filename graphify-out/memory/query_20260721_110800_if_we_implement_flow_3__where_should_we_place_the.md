---
type: "query"
date: "2026-07-21T11:08:00.581070+00:00"
question: "If we implement flow 3, where should we place the School Curriculum feature for consistency and better UX?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Sidebar", "SchoolSettingsPage.tsx", "MinistryValidationCard", "SubjectsPage.tsx", "CurriculumDialog.tsx", "CurriculumConfig"]
---

# Q: If we implement flow 3, where should we place the School Curriculum feature for consistency and better UX?

## Answer

Expanded from original query via graph vocab: [school, settings, subjects, curriculum, navigation, sidebar, route, page, classes, configuration]. Recommended information architecture: make School Curriculum a dedicated feature and route, /school-curriculum, with its own packages/web/src/features/curriculum boundary. Put it in the sidebar academic/entity setup sequence near School Settings, Period Structure, and Subjects. Keep SchoolSettingsPage responsible for global switches and Ministry validation, but turn its custom curriculum control into a status plus Manage curriculum deep link. Add another contextual link in the Subjects page Curriculum menu. The dedicated page should offer grade/category navigation, ministry-versus-school rows, include/exclude/restore actions, custom subject creation, period overrides, totals and validation, affected-class count, staged changes, and one preview-and-apply transaction. Alternatives are a Subjects page tab, which saves navigation space but blurs catalog versus policy, or a School Settings subpage, which has sound ownership but should not be embedded in the existing single settings form. Avoid a modal-only editor because the 12-grade, high-impact workflow needs persistent navigation, comparison, and review space.

## Outcome

- Signal: useful

## Source Nodes

- Sidebar
- SchoolSettingsPage.tsx
- MinistryValidationCard
- SubjectsPage.tsx
- CurriculumDialog.tsx
- CurriculumConfig