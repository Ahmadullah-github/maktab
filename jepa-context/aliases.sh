#!/bin/bash
# Maktab Context Indexer Aliases
# Source this file in your shell: source jepa-context/aliases.sh

# Get the directory where this script is located
JEPA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Indexing aliases
alias ctx-index='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/index_codebase.py"'
alias ctx-index-all='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/index_codebase.py" --package all --clear'
alias ctx-index-web='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/index_codebase.py" --package web'
alias ctx-index-api='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/index_codebase.py" --package api'
alias ctx-index-solver='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/index_codebase.py" --package solver'

# Query aliases
alias ctx='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py"'
alias ctx-web='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package web -f llm --copy'
alias ctx-api='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package api -f llm --copy'
alias ctx-solver='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package solver -f llm --copy'
alias ctx-all='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package all -f llm --copy'

# Quick search aliases (most common use cases)
alias ctx-form='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package web --type component -f llm --copy -n 8'
alias ctx-hook='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package web --type hook -f llm --copy -n 6'
alias ctx-schema='source "$JEPA_DIR/.venv/bin/activate" && python "$JEPA_DIR/scripts/query_context.py" --package web,api --type schema -f llm --copy -n 6'

echo "✓ Maktab Context Indexer aliases loaded!"
echo ""
echo "Available commands:"
echo "  Indexing:"
echo "    ctx-index-all      - Re-index all packages (web, api, solver)"
echo "    ctx-index-web      - Index web package only"
echo "    ctx-index-api      - Index api package only"
echo "    ctx-index-solver   - Index solver package only"
echo ""
echo "  Querying:"
echo "    ctx-web \"query\"    - Search web package (copies to clipboard)"
echo "    ctx-api \"query\"    - Search api package (copies to clipboard)"
echo "    ctx-solver \"query\" - Search solver package (copies to clipboard)"
echo "    ctx-all \"query\"    - Search all packages (copies to clipboard)"
echo ""
echo "  Quick searches:"
echo "    ctx-form \"query\"   - Search components (forms, UI)"
echo "    ctx-hook \"query\"   - Search hooks"
echo "    ctx-schema \"query\" - Search schemas (web + api)"
echo ""
echo "  Advanced:"
echo "    ctx \"query\" [options] - Full control with all options"
echo ""
