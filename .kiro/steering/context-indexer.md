# Context Indexer

Semantic code search for the entire Maktab codebase (web, api, solver). Use this
to gather relevant code context before complex tasks.

## Agent Behavior

When the user requests a task, detect if HIGH CONTEXT is needed:

### High Context Needed When:

- Creating new components/features
- Modifying unfamiliar code
- Bug fixes with unclear source
- Refactoring across files
- Understanding existing patterns
- Working with forms, hooks, or state
- API/backend integration issues
- Solver constraint problems

### High Context NOT Needed When:

- Simple text/style changes
- User already provided the file
- Task is in a file already discussed
- Documentation-only changes

## When High Context Detected

1. **Generate the query command** for the user to run (use aliases if available)
2. **Ask user to paste** the output back into chat
3. **Use the context** to implement the solution

### Command Format (with aliases)

```bash
# If user has sourced aliases (recommended)
ctx-web "QUERY" -n COUNT
ctx-api "QUERY" -n COUNT
ctx-solver "QUERY" -n COUNT
ctx-all "QUERY" -n COUNT

# Without aliases (fallback)
source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "QUERY" -n COUNT --package PACKAGE -f llm --copy
```

### Query Construction Rules

- Use 2-4 keywords describing the task
- Choose appropriate package: `web`, `api`, `solver`, or `all`
- Add `--type` filter when task is specific (hook, component, schema)
- Use `-n 5` for focused tasks, `-n 10` for broader understanding
- Always use `-f llm --copy` for optimized output + clipboard

### Example Commands

| Task                     | Command (with aliases)                   | Command (without aliases)                                                                                                                                           |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create teacher form      | `ctx-web "teacher form validation" -n 8` | `source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "teacher form validation" -n 8 --package web -f llm --copy`                 |
| Add new hook             | `ctx-hook "useQuery mutation" -n 6`      | `source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "useQuery mutation hook" -n 6 --package web --type hook -f llm --copy`      |
| Fix API route            | `ctx-api "teacher routes" -n 5`          | `source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "teacher routes" -n 5 --package api -f llm --copy`                          |
| Solver constraints       | `ctx-solver "constraints" -n 5`          | `source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "constraints" -n 5 --package solver -f llm --copy`                          |
| Cross-package validation | `ctx-all "validation schema" -n 10`      | `source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "validation schema" -n 10 --package all -f llm --copy`                      |
| Work with Zod schemas    | `ctx-schema "teacher validation" -n 6`   | `source jepa-context/.venv/bin/activate && python jepa-context/scripts/query_context.py "zod schema validation" -n 6 --package web,api --type schema -f llm --copy` |

## Response Template

When high context is needed, respond:

```
I need some context from the codebase to help with this. Run this command:

[command here - prefer alias version if user has it]

Then paste the output here (it's already copied to your clipboard).
```

## Index Info

- **Scope**: All three packages
  - `web`: ~2,199 chunks (packages/web/src)
  - `api`: ~415 chunks (packages/api/src)
  - `solver`: ~150 chunks (packages/solver)
- **Total**: ~2,764 chunks
- **Re-index**: `ctx-index-all` (or
  `python jepa-context/scripts/index_codebase.py --package all --clear`)

## Setup Aliases

User should add to `~/.bashrc` or `~/.zshrc`:

```bash
source ~/Projects/maktab/jepa-context/aliases.sh
```

See `jepa-context/SETUP.md` for full setup instructions.
