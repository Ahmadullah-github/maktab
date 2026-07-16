---
type: "query"
date: "2026-07-16T14:22:42.723620+00:00"
question: "Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["typescript", "compilerOptions", "baseUrl", "tsconfig.json", "vite", "package.json"]
---

# Q: Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?

## Answer

Expanded from graph vocabulary: [typescript, compiler, tsconfig, config, package, build, vite, react]. The repository currently resolves TypeScript 5.9.3 across web and API. Its only detected TypeScript 7 removed option is packages/web/tsconfig.json baseUrl '.', while every paths target already has an explicit './src/' prefix and Vite independently maps '@' to './src'. Remove baseUrl now; do not hide it with ignoreDeprecations because that is only a temporary TypeScript 6 bridge and TypeScript 7 rejects the option. Keep TypeScript 5.9.3 for the moment or stage through TypeScript 6 before making 7 the sole compiler. TypeScript 7 is officially production-ready, but 7.0 ships without a compiler API, while this repo uses typescript-eslint and ts-node tooling that depends on that API. A low-risk trial can use the TypeScript 7 editor extension or Microsoft's side-by-side TypeScript 7 compiler plus @typescript/typescript6 compatibility package. Reassess a sole-compiler upgrade at TypeScript 7.1 or after the toolchain explicitly supports the new API.

## Outcome

- Signal: useful

## Source Nodes

- typescript
- compilerOptions
- baseUrl
- tsconfig.json
- vite
- package.json