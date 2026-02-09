# Context Indexer Cheat Sheet

Quick reference for the Maktab context indexer commands.

## Setup (One-time)

```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'source ~/Projects/maktab/jepa-context/aliases.sh' >> ~/.bashrc
source ~/.bashrc

# Initial index
ctx-index-all
```

## Common Commands

### Search by Package

```bash
ctx-web "query" -n 5      # React frontend
ctx-api "query" -n 5      # Express backend
ctx-solver "query" -n 5   # Python solver
ctx-all "query" -n 10     # All packages
```

### Quick Searches

```bash
ctx-form "query"          # Components/forms
ctx-hook "query"          # React hooks
ctx-schema "query"        # Validation schemas
```

### Indexing

```bash
ctx-index-all             # Re-index everything
ctx-index-web             # Re-index web only
ctx-index-api             # Re-index api only
ctx-index-solver          # Re-index solver only
```

## Real-World Examples

```bash
# Frontend: Find form validation patterns
ctx-web "teacher form validation" -n 8

# Frontend: Find hook usage
ctx-hook "useQuery mutation" -n 6

# Backend: Find API routes
ctx-api "teacher routes CRUD" -n 5

# Backend: Find service patterns
ctx-api "service repository" -n 5

# Solver: Find constraints
ctx-solver "teacher constraints" -n 5

# Cross-package: Find validation everywhere
ctx-all "validation schema" -n 10

# Schemas: Find Zod schemas in web and api
ctx-schema "teacher validation" -n 6
```

## Tips

- **Specific > General**: "teacher form validation" > "teacher"
- **Adjust count**: `-n 5` (focused) vs `-n 15` (broad)
- **Package-specific first**: Try `ctx-web` before `ctx-all`
- **Results auto-copy**: Just paste into chat!
- **Re-index after changes**: Run `ctx-index-all` after major updates

## Without Aliases

If you haven't set up aliases:

```bash
# Query
source jepa-context/.venv/bin/activate && \
  python jepa-context/scripts/query_context.py "query" \
  --package web -n 5 -f llm --copy

# Index
source jepa-context/.venv/bin/activate && \
  python jepa-context/scripts/index_codebase.py \
  --package all --clear
```

## Advanced Options

```bash
# Full control
ctx "query" \
  --package web,api \
  --type component \
  -n 10 \
  -f llm \
  --copy

# Options:
#   --package: web, api, solver, all, or comma-separated
#   --type: component, hook, route, schema, util, api
#   -n: Number of results
#   -f: Format (llm, markdown, steering, raw)
#   --copy: Copy to clipboard
```

## Index Stats

- **web**: ~2,199 chunks (React frontend)
- **api**: ~415 chunks (Express backend)
- **solver**: ~150 chunks (Python solver)
- **Total**: ~2,764 chunks

## Troubleshooting

```bash
# Aliases not working
source jepa-context/aliases.sh

# No results
ctx-index-all

# Python errors
cd jepa-context && source .venv/bin/activate && pip install -r requirements.txt
```
