---
type: "query"
date: "2026-07-18T09:14:27.197187+00:00"
question: "When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["TeacherSelectionList.tsx", "useSmartTeacherSelection.ts", "useAssignmentMutations.ts", "solver.ts", "Teacher"]
---

# Q: When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?

## Answer

Expanded from original query via graph vocab: [assignment, assign, teacher, subject, capability, compatibility, primary, allowed, generalist, conflict, batch, solver]. The three entry points share one contract mismatch: the UI treats empty capabilities as generalist and enables ordinary assignment; client validation treats primary and allowed as preferences; API single-assignment preflight warns that capability will be added automatically; but canonical batch persistence hard-rejects missing capabilities. The solver requires an explicit primary or allowed capability. Recommended policy: keep all teachers visible, classify unlisted teachers as needs authorization rather than generalist, and offer an explicit Add as allowed and assign action. Apply the capability grant and assignment in one transaction, preserve the server hard guard for direct or stale clients, recheck workload and availability after authorization, and use the same server eligibility projection in all three UIs. Do not silently promote to primary and do not persist assignments without a capability. If unrestricted generalists are needed, model that explicitly instead of inferring it from empty lists.

## Outcome

- Signal: useful

## Source Nodes

- TeacherSelectionList.tsx
- useSmartTeacherSelection.ts
- useAssignmentMutations.ts
- solver.ts
- Teacher