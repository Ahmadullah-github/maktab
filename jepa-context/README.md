# Maktab Context Indexer

Semantic code search for the Maktab codebase using embeddings and ChromaDB.

## Quick Start

### 1. Setup Aliases (One-time)

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Maktab Context Indexer
source ~/Projects/maktab/jepa-context/aliases.sh
```

Then reload your shell:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

### 2. Index the Codebase

First time or after major changes:

```bash
ctx-index-all
```

This indexes all three packages (web, api, solver) and takes ~2-3 minutes.

### 3. Query the Code

```bash
# Search web package (React frontend)
ctx-web "teacher form validation" -n 8

# Search api package (Express backend)
ctx-api "teacher routes" -n 5

# Search solver package (Python)
ctx-solver "constraints" -n 5

# Search all packages
ctx-all "validation" -n 10
```

Results are automatically copied to your clipboard!

## Available Commands

### Indexing

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `ctx-index-all`    | Re-index all packages (clears existing) |
| `ctx-index-web`    | Index web package only                  |
| `ctx-index-api`    | Index api package only                  |
| `ctx-index-solver` | Index solver package only               |

### Querying

| Command                   | Description           |
| ------------------------- | --------------------- |
| `ctx-web "query" -n 5`    | Search web package    |
| `ctx-api "query" -n 5`    | Search api package    |
| `ctx-solver "query" -n 5` | Search solver package |
| `ctx-all "query" -n 10`   | Search all packages   |

### Quick Searches

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `ctx-form "query"`   | Search components/forms (web) |
| `ctx-hook "query"`   | Search hooks (web)            |
| `ctx-schema "query"` | Search schemas (web + api)    |

### Advanced

For full control:

```bash
ctx "query" --package web,api --type component -n 10 -f llm --copy
```

Options:

- `--package`: `web`, `api`, `solver`, `all`, or comma-separated
- `--type`: `component`, `hook`, `route`, `schema`, `util`, `api`
- `-n`: Number of results (default: 8)
- `-f`: Format: `llm` (compact), `markdown`, `steering`, `raw`
- `--copy`: Copy to clipboard (requires pyperclip)

## Examples

### Frontend Development

```bash
# Find teacher form examples
ctx-form "teacher form validation" -n 8

# Find hook patterns
ctx-hook "useQuery mutation" -n 6

# Find component patterns
ctx-web "dialog modal" -n 5
```

### Backend Development

```bash
# Find API route patterns
ctx-api "teacher routes CRUD" -n 5

# Find service patterns
ctx-api "service repository" -n 5

# Find validation schemas
ctx-schema "teacher validation" -n 6
```

### Solver Development

```bash
# Find constraint implementations
ctx-solver "constraints" -n 5

# Find strategy patterns
ctx-solver "solver strategy" -n 5
```

### Cross-Package Search

```bash
# Find validation across frontend and backend
ctx-all "validation schema" -n 10

# Find teacher-related code everywhere
ctx-all "teacher" -n 15
```

## How It Works

1. **Indexing**: Code files are chunked into semantic units (functions, classes,
   components)
2. **Embedding**: Each chunk is converted to a vector using
   `BAAI/bge-small-en-v1.5`
3. **Storage**: Vectors stored in ChromaDB with metadata (file path, type, name)
4. **Querying**: Your query is embedded and matched against stored vectors
5. **Results**: Most relevant code chunks returned with context

## Index Statistics

After running `ctx-index-all`:

- **web**: ~2,199 chunks (React frontend)
- **api**: ~415 chunks (Express backend)
- **solver**: ~150 chunks (Python solver)
- **Total**: ~2,764 chunks

## When to Re-index

Re-run `ctx-index-all` when:

- Adding new files or features
- Major refactoring
- After pulling significant changes
- Search results seem outdated

## Troubleshooting

### "Module not found" errors

```bash
cd jepa-context
source .venv/bin/activate
pip install -r requirements.txt
```

### Aliases not working

Make sure you sourced the aliases file:

```bash
source jepa-context/aliases.sh
```

### No results found

Re-index the codebase:

```bash
ctx-index-all
```

## Architecture

```
jepa-context/
├── scripts/
│   ├── index_codebase.py    # Indexing script
│   └── query_context.py     # Query script
├── indexer/
│   ├── chunker.py           # Code chunking logic
│   ├── embedder.py          # Embedding generation
│   └── index.py             # ChromaDB integration
├── db/                      # ChromaDB storage
├── aliases.sh               # Bash aliases
└── README.md               # This file
```

## Tips

1. **Use specific queries**: "teacher form validation" > "teacher"
2. **Adjust result count**: Use `-n 5` for focused, `-n 15` for broad
3. **Filter by type**: Use `--type component` to narrow results
4. **Package-specific**: Search `ctx-web` first, then `ctx-all` if needed
5. **Clipboard**: Results auto-copy, just paste into chat!
