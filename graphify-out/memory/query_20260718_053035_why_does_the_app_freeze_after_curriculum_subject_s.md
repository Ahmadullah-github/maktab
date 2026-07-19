---
type: "debugging"
date: "2026-07-18T05:30:35.618818+00:00"
question: "Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectsPage", "CurriculumDialog", "TeacherBulkImportDialog", "useBulkImportTeachers"]
---

# Q: Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?

## Answer

The API requests complete and data commits successfully. Curriculum was opening a Radix Dialog from a modal DropdownMenu in the same event, leaving document.body with pointer-events:none after the dialog closed. Defer opening the dialog with requestAnimationFrame after DropdownMenu onSelect closes it. Teacher bulk import intentionally kept its modal Sheet open after success; close it through onOpenChange(false). Browser verification confirms both overlays detach and body pointer-events returns to auto.

## Outcome

- Signal: useful

## Source Nodes

- SubjectsPage
- CurriculumDialog
- TeacherBulkImportDialog
- useBulkImportTeachers