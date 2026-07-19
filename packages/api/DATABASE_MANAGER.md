# Maktab database console

`db_manager.py` is a dependency-free Python console for the API's SQLite
database. From the repository root, open the guided menu with:

```bash
python3 packages/api/db_manager.py
```

The default database is `packages/api/timetable.db`. Use `--database PATH` or
the `DATABASE_PATH` environment variable to select another SQLite file.

## Common commands

```bash
# Inspect data and structure
python3 packages/api/db_manager.py info
python3 packages/api/db_manager.py tables
python3 packages/api/db_manager.py schema teacher
python3 packages/api/db_manager.py stats
python3 packages/api/db_manager.py view teacher --limit 20
python3 packages/api/db_manager.py foreign-keys teaching_assignment

# Run SQL (read-only unless --write is explicit)
python3 packages/api/db_manager.py sql "SELECT id, fullName FROM teacher LIMIT 10"
python3 packages/api/db_manager.py sql --file report.sql
python3 packages/api/db_manager.py sql --write "UPDATE teacher SET isActive = 1"
python3 packages/api/db_manager.py shell

# Back up, export, and maintain
python3 packages/api/db_manager.py backup
python3 packages/api/db_manager.py backups
python3 packages/api/db_manager.py export-json --output database-export.json
python3 packages/api/db_manager.py dump-sql --output database-dump.sql
python3 packages/api/db_manager.py integrity
python3 packages/api/db_manager.py vacuum
```

## Destructive commands

These commands ask for typed confirmation and make a consistent SQLite backup
before deleting or replacing anything:

```bash
python3 packages/api/db_manager.py delete teacher
python3 packages/api/db_manager.py wipe
python3 packages/api/db_manager.py restore path/to/backup.db
```

`wipe` removes rows from every application table but preserves TypeORM's
`migrations` and `typeorm_metadata` tables, when present. This keeps the empty
schema usable by the API. Clearing migration history with
`--include-migrations` is normally unsafe because the next API startup may try
to recreate tables that still exist.

Use `--yes` only in trusted automation where skipping confirmation is
intentional. Destructive operations still create a safety backup.

## SQL shell commands

- `.tables` — show tables and row counts
- `.schema [TABLE]` — show all schema SQL or one table's schema
- `.stats` — show record counts
- `.write on` / `.write off` — enable or disable changing statements
- `.quit` / `.exit` — leave the shell

End statements with a semicolon. Multi-line statements and SQLite triggers are
supported.
