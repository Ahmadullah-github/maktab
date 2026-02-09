# Context Indexer Setup Guide

Quick 3-step setup for the Maktab context indexer.

## Step 1: Add Aliases to Your Shell

Add this line to your shell config file:

### For Bash users:

```bash
echo 'source ~/Projects/maktab/jepa-context/aliases.sh' >> ~/.bashrc
source ~/.bashrc
```

### For Zsh users:

```bash
echo 'source ~/Projects/maktab/jepa-context/aliases.sh' >> ~/.zshrc
source ~/.zshrc
```

**Note**: Adjust the path if your project is in a different location.

## Step 2: Index the Codebase

Run this once to build the initial index:

```bash
ctx-index-all
```

This takes 2-3 minutes and indexes all three packages (web, api, solver).

## Step 3: Start Searching!

```bash
# Search for teacher forms
ctx-web "teacher form" -n 5

# Search for API routes
ctx-api "teacher routes" -n 5

# Search for solver constraints
ctx-solver "constraints" -n 5

# Search everything
ctx-all "validation" -n 10
```

Results are automatically copied to your clipboard!

## Quick Reference Card

```bash
# INDEXING
ctx-index-all          # Re-index everything (do this first!)
ctx-index-web          # Re-index web only
ctx-index-api          # Re-index api only
ctx-index-solver       # Re-index solver only

# SEARCHING (auto-copies to clipboard)
ctx-web "query" -n 5   # Search React frontend
ctx-api "query" -n 5   # Search Express backend
ctx-solver "query" -n 5 # Search Python solver
ctx-all "query" -n 10  # Search all packages

# QUICK SEARCHES
ctx-form "query"       # Find components/forms
ctx-hook "query"       # Find React hooks
ctx-schema "query"     # Find validation schemas
```

## Usage Tips

1. **Be specific**: "teacher form validation" finds better results than
   "teacher"
2. **Adjust count**: Use `-n 5` for focused results, `-n 15` for broader search
3. **Package-specific**: Start with `ctx-web`, `ctx-api`, or `ctx-solver` for
   faster results
4. **Re-index**: Run `ctx-index-all` after major code changes

## Troubleshooting

### Aliases not found

```bash
# Make sure you sourced the file
source jepa-context/aliases.sh

# Or reload your shell
source ~/.bashrc  # or ~/.zshrc
```

### No results

```bash
# Re-index the codebase
ctx-index-all
```

### Python errors

```bash
# Reinstall dependencies
cd jepa-context
source .venv/bin/activate
pip install -r requirements.txt
```

## What Gets Indexed?

- **web** (2,199 chunks): All TypeScript/React files in `packages/web/src`
- **api** (415 chunks): All TypeScript files in `packages/api/src`
- **solver** (150 chunks): All Python files in `packages/solver`

Files in `node_modules`, `.git`, `dist`, `build`, `.venv`, `__pycache__`, and
`tests` are skipped.

## Next Steps

See [README.md](./README.md) for detailed documentation and examples.
