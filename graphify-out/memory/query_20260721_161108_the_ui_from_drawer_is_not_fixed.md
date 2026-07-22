---
type: "query"
date: "2026-07-21T16:11:08.480447+00:00"
question: "the ui from drawer is not fixed"
contributor: "graphify"
outcome: "corrected"
correction: "The actual drawer failure was the shared CommandItem CSS selector data-[disabled], not the form field wiring. It must match data-[disabled=true] because cmdk emits data-disabled=false for enabled items."
source_nodes: ["command.tsx", "RoomSelector.tsx", "ClassEditDrawer.tsx"]
---

# Q: the ui from drawer is not fixed

## Answer

Expanded from graph vocabulary: [room, selector, drawer, class, fixed, form, select, inspector, edit, home, preferred]. The drawer used RoomSelector correctly, but the shared CommandItem CSS matched data-disabled by attribute presence. cmdk emits data-disabled=false on enabled options, so all room options received pointer-events-none and opacity-50. Changed the selector to data-[disabled=true], retained controlled close-on-select, and sized the room popover to the trigger width with a 240px scroll list. Added a regression test proving enabled cmdk items remain clickable. Web tests, type-check, lint, and diff check pass.

## Outcome

- Signal: corrected
- Correction: The actual drawer failure was the shared CommandItem CSS selector data-[disabled], not the form field wiring. It must match data-[disabled=true] because cmdk emits data-disabled=false for enabled items.

## Source Nodes

- command.tsx
- RoomSelector.tsx
- ClassEditDrawer.tsx