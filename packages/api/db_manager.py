#!/usr/bin/env python3
"""Safe, interactive and scriptable SQLite console for Maktab.

The console uses only Python's standard library. Run it without a subcommand
for a guided menu, or use a subcommand from scripts and CI.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Iterable, Sequence


DEFAULT_DATABASE = Path(__file__).resolve().parent / "timetable.db"
MIGRATION_TABLES = frozenset({"migrations", "typeorm_metadata"})
MAX_CELL_WIDTH = 50


class Style:
    enabled = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
    reset = "\033[0m"
    bold = "\033[1m"
    red = "\033[31m"
    green = "\033[32m"
    yellow = "\033[33m"

    @classmethod
    def paint(cls, text: str, color: str) -> str:
        return f"{color}{text}{cls.reset}" if cls.enabled else text


def heading(title: str) -> None:
    print(f"\n{Style.paint(title, Style.bold)}")
    print("=" * len(title))


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def shorten(value: object, width: int = MAX_CELL_WIDTH) -> str:
    if value is None:
        text = "NULL"
    elif isinstance(value, bytes):
        text = f"<BLOB {len(value)} bytes>"
    else:
        text = str(value).replace("\n", "\\n").replace("\r", "\\r")
    return text if len(text) <= width else text[: width - 1] + "…"


def print_rows(columns: Sequence[str], rows: Sequence[Sequence[object]]) -> None:
    """Render query results without a third-party table package."""
    if not columns:
        print("(statement returned no columns)")
        return
    if not rows:
        print("(0 rows)")
        return
    rendered = [[shorten(value) for value in row] for row in rows]
    widths = [
        min(MAX_CELL_WIDTH, max(len(column), *(len(row[i]) for row in rendered)))
        for i, column in enumerate(columns)
    ]

    def line(values: Sequence[str]) -> str:
        return " | ".join(value.ljust(widths[i]) for i, value in enumerate(values))

    print(line(columns))
    print("-+-".join("-" * width for width in widths))
    for row in rendered:
        print(line(row))
    print(f"\n({len(rows)} row{'s' if len(rows) != 1 else ''})")


def split_sql(script: str) -> list[str]:
    """Split SQL while respecting quoted semicolons, comments, and triggers."""
    statements: list[str] = []
    buffer = ""
    for character in script:
        buffer += character
        if character == ";" and sqlite3.complete_statement(buffer):
            if buffer.strip():
                statements.append(buffer.strip())
            buffer = ""
    if buffer.strip():
        statements.append(buffer.strip())
    return statements


class DatabaseManager:
    def __init__(self, database_path: Path, *, create: bool = False) -> None:
        self.path = database_path.expanduser().resolve()
        if not self.path.exists() and not create:
            raise FileNotFoundError(
                f"Database not found: {self.path}\n"
                "Pass --create only when you intentionally want a new SQLite file."
            )
        if create:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, timeout=5)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.execute("PRAGMA busy_timeout = 5000")

    def close(self) -> None:
        self.conn.close()

    def table_names(self, *, include_internal: bool = False) -> list[str]:
        condition = "" if include_internal else "AND name NOT LIKE 'sqlite_%'"
        rows = self.conn.execute(
            f"SELECT name FROM sqlite_master WHERE type = 'table' {condition} ORDER BY name"
        ).fetchall()
        return [row["name"] for row in rows]

    def require_table(self, table: str) -> str:
        if table not in self.table_names(include_internal=True):
            available = ", ".join(self.table_names()) or "(none)"
            raise ValueError(f"Unknown table '{table}'. Available tables: {available}")
        return table

    def table_counts(self) -> list[tuple[str, int]]:
        return [
            (
                table,
                self.conn.execute(
                    f"SELECT COUNT(*) FROM {quote_identifier(table)}"
                ).fetchone()[0],
            )
            for table in self.table_names()
        ]

    def show_info(self) -> None:
        heading("Database information")
        page_size = self.conn.execute("PRAGMA page_size").fetchone()[0]
        page_count = self.conn.execute("PRAGMA page_count").fetchone()[0]
        values = [
            ("Path", str(self.path)),
            ("File size", f"{self.path.stat().st_size:,} bytes"),
            ("Allocated pages", f"{page_count * page_size:,} bytes"),
            ("SQLite version", self.conn.execute("SELECT sqlite_version()").fetchone()[0]),
            ("Journal mode", self.conn.execute("PRAGMA journal_mode").fetchone()[0]),
            ("Foreign keys", "on"),
            ("Tables", str(len(self.table_names()))),
        ]
        for label, value in values:
            print(f"{label:<18} {value}")

    def show_tables(self, *, include_internal: bool = False) -> None:
        heading("Tables")
        rows = []
        for table in self.table_names(include_internal=include_internal):
            count = self.conn.execute(
                f"SELECT COUNT(*) FROM {quote_identifier(table)}"
            ).fetchone()[0]
            columns = self.conn.execute(
                f"PRAGMA table_info({quote_identifier(table)})"
            ).fetchall()
            rows.append((table, count, len(columns)))
        print_rows(("table", "rows", "columns"), rows)

    def show_schema(self, table: str | None = None) -> None:
        heading(f"Schema: {table}" if table else "Database schema")
        parameters: tuple[object, ...] = ()
        condition = "AND name NOT LIKE 'sqlite_%'"
        if table:
            self.require_table(table)
            condition = "AND tbl_name = ?"
            parameters = (table,)
        rows = self.conn.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_master "
            f"WHERE type IN ('table', 'index', 'trigger', 'view') {condition} "
            "ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 "
            "WHEN 'index' THEN 2 ELSE 3 END, name",
            parameters,
        ).fetchall()
        if not rows:
            print("No schema objects found.")
            return
        for row in rows:
            if row["sql"]:
                print(f"\n-- {row['type']} {row['name']} ({row['tbl_name']})")
                print(row["sql"].rstrip(";") + ";")

    def show_foreign_keys(self, table: str) -> None:
        table = self.require_table(table)
        heading(f"Foreign keys: {table}")
        rows = self.conn.execute(
            f"PRAGMA foreign_key_list({quote_identifier(table)})"
        ).fetchall()
        print_rows(
            ("id", "from", "references", "to", "on_update", "on_delete"),
            [
                (row["id"], row["from"], row["table"], row["to"], row["on_update"], row["on_delete"])
                for row in rows
            ],
        )

    def show_statistics(self) -> None:
        heading("Table statistics")
        counts = self.table_counts()
        print_rows(("table", "rows"), counts)
        print(f"Total records: {sum(count for _, count in counts):,}")

    def view_table(self, table: str, *, limit: int = 50, offset: int = 0) -> None:
        table = self.require_table(table)
        if not 1 <= limit <= 1000:
            raise ValueError("--limit must be between 1 and 1000")
        if offset < 0:
            raise ValueError("--offset cannot be negative")
        cursor = self.conn.execute(
            f"SELECT * FROM {quote_identifier(table)} LIMIT ? OFFSET ?", (limit, offset)
        )
        rows = cursor.fetchall()
        heading(f"Data: {table} (limit {limit}, offset {offset})")
        print_rows([item[0] for item in cursor.description or ()], rows)

    def execute_sql(self, sql: str, *, allow_write: bool = False) -> None:
        statements = split_sql(sql)
        if not statements:
            raise ValueError("No SQL statement was supplied")
        self.conn.execute(f"PRAGMA query_only = {'OFF' if allow_write else 'ON'}")
        try:
            for index, statement in enumerate(statements, 1):
                if len(statements) > 1:
                    print(f"\n-- statement {index}/{len(statements)}")
                cursor = self.conn.execute(statement)
                if cursor.description:
                    print_rows(
                        [item[0] for item in cursor.description], cursor.fetchall()
                    )
                else:
                    changed = cursor.rowcount if cursor.rowcount >= 0 else 0
                    print(f"OK ({changed} row{'s' if changed != 1 else ''} changed)")
            if allow_write:
                self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        finally:
            self.conn.execute("PRAGMA query_only = OFF")

    def sql_shell(self) -> None:
        heading("Maktab SQL shell")
        print("Read-only by default. Use '.write on' to allow changes.")
        print("Commands: .tables, .schema [TABLE], .stats, .write on|off, .help, .quit")
        buffer = ""
        allow_write = False
        while True:
            try:
                line = input("...> " if buffer else "sql> ")
            except (EOFError, KeyboardInterrupt):
                print()
                return
            if not buffer and line.strip().startswith("."):
                parts = line.strip().split()
                command = parts[0].lower()
                try:
                    if command in {".quit", ".exit"}:
                        return
                    if command == ".tables":
                        self.show_tables()
                    elif command == ".stats":
                        self.show_statistics()
                    elif command == ".schema":
                        self.show_schema(parts[1] if len(parts) > 1 else None)
                    elif command == ".write" and len(parts) == 2:
                        if parts[1].lower() not in {"on", "off"}:
                            raise ValueError("Usage: .write on|off")
                        allow_write = parts[1].lower() == "on"
                        print(f"SQL writes {'enabled' if allow_write else 'disabled'}.")
                    elif command == ".help":
                        print(".tables | .schema [TABLE] | .stats | .write on|off | .quit")
                    else:
                        print("Unknown dot command. Use .help.")
                except (ValueError, sqlite3.Error) as error:
                    print(Style.paint(f"Error: {error}", Style.red))
                continue
            buffer += line + "\n"
            if not sqlite3.complete_statement(buffer):
                continue
            try:
                self.execute_sql(buffer, allow_write=allow_write)
            except sqlite3.OperationalError as error:
                if "readonly" in str(error).lower() and not allow_write:
                    print(Style.paint("Write blocked. Run '.write on' first.", Style.yellow))
                else:
                    print(Style.paint(f"SQL error: {error}", Style.red))
            except (ValueError, sqlite3.Error) as error:
                print(Style.paint(f"SQL error: {error}", Style.red))
            finally:
                buffer = ""

    def integrity_check(self) -> bool:
        heading("Database integrity")
        integrity = [row[0] for row in self.conn.execute("PRAGMA integrity_check")]
        foreign_keys = self.conn.execute("PRAGMA foreign_key_check").fetchall()
        healthy = integrity == ["ok"] and not foreign_keys
        print(f"SQLite integrity: {integrity[0] if len(integrity) == 1 else integrity}")
        if foreign_keys:
            print_rows(("table", "rowid", "parent", "fk_id"), [tuple(row) for row in foreign_keys])
        else:
            print("Foreign keys:     ok")
        print(Style.paint("Database is healthy." if healthy else "Database has integrity problems.", Style.green if healthy else Style.red))
        return healthy

    def _backup_path(self, label: str = "backup") -> Path:
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S-%f")
        return self.path.with_name(f"{self.path.name}.{label}-{timestamp}.db")

    def backup(self, output: Path | None = None, *, quiet: bool = False) -> Path:
        destination = (output or self._backup_path()).expanduser().resolve()
        if destination == self.path:
            raise ValueError("Backup path must differ from the active database")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(destination) as backup_connection:
            self.conn.backup(backup_connection)
        if not quiet:
            print(Style.paint(f"Backup created: {destination}", Style.green))
        return destination

    def list_backups(self) -> None:
        heading("Database backups")
        patterns = (
            f"{self.path.name}.backup-*.db",
            f"{self.path.name}.pre-*.db",
            f"{self.path.stem}.backup.*.db",
            f"{self.path.name}.backup-*",
            f"{self.path.name}.*backup-*",
        )
        found: dict[Path, None] = {}
        for pattern in patterns:
            for path in self.path.parent.glob(pattern):
                if path.name.endswith(("-wal", "-shm")):
                    continue
                found[path] = None
        backups = sorted(found, key=lambda path: path.stat().st_mtime, reverse=True)
        print_rows(
            ("file", "bytes", "modified"),
            [
                (path.name, f"{path.stat().st_size:,}", datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"))
                for path in backups
            ],
        )

    def restore(self, source: Path) -> Path:
        source = source.expanduser().resolve()
        if not source.is_file():
            raise FileNotFoundError(f"Backup not found: {source}")
        if source == self.path:
            raise ValueError("The backup and active database paths are identical")
        with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as source_connection:
            check = source_connection.execute("PRAGMA integrity_check").fetchone()[0]
            if check != "ok":
                raise sqlite3.DatabaseError(f"Backup integrity check failed: {check}")
            safety = self.backup(self._backup_path("pre-restore"), quiet=True)
            source_connection.backup(self.conn)
        self.conn.commit()
        print(Style.paint(f"Restored database from: {source}", Style.green))
        print(f"Previous database saved as: {safety}")
        return safety

    def delete_table_data(self, table: str) -> tuple[int, Path]:
        table = self.require_table(table)
        if table.startswith("sqlite_"):
            raise ValueError("SQLite internal tables cannot be cleared directly")
        count = self.conn.execute(f"SELECT COUNT(*) FROM {quote_identifier(table)}").fetchone()[0]
        safety = self.backup(self._backup_path("pre-delete"), quiet=True)
        try:
            self.conn.execute(f"DELETE FROM {quote_identifier(table)}")
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        print(Style.paint(f"Deleted {count:,} rows from {table}.", Style.green))
        print(f"Safety backup: {safety}")
        return count, safety

    def wipe(self, *, include_migrations: bool = False) -> tuple[int, Path]:
        tables = self.table_names()
        preserved = set() if include_migrations else MIGRATION_TABLES
        targets = [table for table in tables if table not in preserved]
        counts = {
            table: self.conn.execute(f"SELECT COUNT(*) FROM {quote_identifier(table)}").fetchone()[0]
            for table in targets
        }
        safety = self.backup(self._backup_path("pre-wipe"), quiet=True)
        self.conn.commit()
        self.conn.execute("PRAGMA foreign_keys = OFF")
        try:
            self.conn.execute("BEGIN IMMEDIATE")
            for table in targets:
                self.conn.execute(f"DELETE FROM {quote_identifier(table)}")
            if "sqlite_sequence" in self.table_names(include_internal=True) and targets:
                placeholders = ", ".join("?" for _ in targets)
                self.conn.execute(f"DELETE FROM sqlite_sequence WHERE name IN ({placeholders})", targets)
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        finally:
            self.conn.execute("PRAGMA foreign_keys = ON")
        issues = self.conn.execute("PRAGMA foreign_key_check").fetchall()
        if issues:
            raise sqlite3.IntegrityError(
                f"Wipe completed but found {len(issues)} foreign-key violations; restore {safety}"
            )
        total = sum(counts.values())
        print(Style.paint(f"Deleted {total:,} rows from {len(targets)} tables.", Style.green))
        if not include_migrations:
            kept = ", ".join(sorted(set(tables) & MIGRATION_TABLES)) or "none present"
            print(f"Preserved migration metadata: {kept}")
        print(f"Safety backup: {safety}")
        return total, safety

    def export_json(self, output: Path) -> Path:
        output = output.expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        tables = {
            table: [dict(row) for row in self.conn.execute(f"SELECT * FROM {quote_identifier(table)}")]
            for table in self.table_names()
        }
        data = {
            "_metadata": {
                "database": str(self.path),
                "exportedAt": datetime.now().astimezone().isoformat(),
                "format": 1,
            },
            "tables": tables,
        }
        output.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
        print(Style.paint(f"JSON export created: {output}", Style.green))
        return output

    def dump_sql(self, output: Path) -> Path:
        output = output.expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", encoding="utf-8", newline="\n") as handle:
            for line in self.conn.iterdump():
                handle.write(line + "\n")
        print(Style.paint(f"SQL dump created: {output}", Style.green))
        return output

    def vacuum(self) -> None:
        self.conn.execute("VACUUM")
        print(Style.paint("Database vacuum completed.", Style.green))


def confirm(prompt: str, phrase: str) -> bool:
    print(Style.paint(prompt, Style.red))
    try:
        return input(f"Type {phrase!r} to continue: ").strip() == phrase
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def interactive_menu(manager: DatabaseManager) -> None:
    options = """
  1. Database information       9.  Run a SQL statement
  2. List tables                10. Open the SQL shell
  3. View table rows            11. Export all data to JSON
  4. Show table/schema SQL      12. Create a SQL dump
  5. Table statistics           13. Vacuum database
  6. Integrity check            14. Delete all rows from one table
  7. Create backup              99. Wipe all application data
  8. List backups               0.  Exit
"""
    while True:
        heading("Maktab database console")
        print(f"Database: {manager.path}")
        print(options)
        try:
            choice = input("Choose an operation: ").strip()
            if choice == "0":
                return
            if choice == "1":
                manager.show_info()
            elif choice == "2":
                manager.show_tables()
            elif choice == "3":
                table = input("Table name: ").strip()
                manager.view_table(table, limit=int(input("Row limit [50]: ").strip() or "50"))
            elif choice == "4":
                manager.show_schema(input("Table name (blank for everything): ").strip() or None)
            elif choice == "5":
                manager.show_statistics()
            elif choice == "6":
                manager.integrity_check()
            elif choice == "7":
                manager.backup()
            elif choice == "8":
                manager.list_backups()
            elif choice == "9":
                statement = input("SQL: ").strip()
                allow_write = confirm("Allow this SQL to change the database?", "ALLOW SQL WRITE")
                manager.execute_sql(statement, allow_write=allow_write)
            elif choice == "10":
                manager.sql_shell()
            elif choice == "11":
                manager.export_json(Path(input("Output [database-export.json]: ").strip() or "database-export.json"))
            elif choice == "12":
                manager.dump_sql(Path(input("Output [database-dump.sql]: ").strip() or "database-dump.sql"))
            elif choice == "13":
                manager.vacuum()
            elif choice == "14":
                table = input("Table to clear: ").strip()
                if confirm(f"Delete every row from {table!r}?", f"DELETE {table}"):
                    manager.delete_table_data(table)
                else:
                    print("Cancelled.")
            elif choice == "99":
                if confirm("Delete ALL application data? Migration history is preserved.", "WIPE ALL DATA"):
                    manager.wipe()
                else:
                    print("Cancelled.")
            else:
                print(Style.paint("Unknown option.", Style.yellow))
        except (ValueError, OSError, sqlite3.Error) as error:
            print(Style.paint(f"Error: {error}", Style.red))
        try:
            input("\nPress Enter to continue...")
        except (EOFError, KeyboardInterrupt):
            print()
            return


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Inspect, query, back up, export, and maintain the Maktab SQLite database.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python3 db_manager.py
  python3 db_manager.py tables
  python3 db_manager.py view teacher --limit 20
  python3 db_manager.py sql "SELECT id, fullName FROM teacher LIMIT 10"
  python3 db_manager.py sql --write "UPDATE teacher SET isActive = 1"
  python3 db_manager.py shell
  python3 db_manager.py wipe
""",
    )
    parser.add_argument("--database", "-d", type=Path, default=Path(os.environ.get("DATABASE_PATH", DEFAULT_DATABASE)), help="SQLite file (default: DATABASE_PATH or packages/api/timetable.db)")
    parser.add_argument("--create", action="store_true", help="allow creation when --database does not exist")
    subs = parser.add_subparsers(dest="command")
    subs.add_parser("info", help="show database metadata")
    tables = subs.add_parser("tables", help="list tables and row counts")
    tables.add_argument("--internal", action="store_true")
    schema = subs.add_parser("schema", help="show schema SQL")
    schema.add_argument("table", nargs="?")
    foreign_keys = subs.add_parser("foreign-keys", help="show a table's foreign keys")
    foreign_keys.add_argument("table")
    subs.add_parser("stats", help="show all table row counts")
    view = subs.add_parser("view", help="view rows from a table")
    view.add_argument("table")
    view.add_argument("--limit", type=int, default=50)
    view.add_argument("--offset", type=int, default=0)
    sql = subs.add_parser("sql", help="run SQL; writes require --write")
    source = sql.add_mutually_exclusive_group(required=True)
    source.add_argument("statement", nargs="?")
    source.add_argument("--file", type=Path)
    sql.add_argument("--write", action="store_true")
    subs.add_parser("shell", help="open an interactive SQL shell")
    backup = subs.add_parser("backup", help="create a consistent backup")
    backup.add_argument("--output", "-o", type=Path)
    subs.add_parser("backups", help="list backups beside the database")
    restore = subs.add_parser("restore", help="restore a backup")
    restore.add_argument("source", type=Path)
    restore.add_argument("--yes", action="store_true")
    export_json = subs.add_parser("export-json", help="export every table to JSON")
    export_json.add_argument("--output", "-o", type=Path, default=Path("database-export.json"))
    dump = subs.add_parser("dump-sql", help="create a complete SQL dump")
    dump.add_argument("--output", "-o", type=Path, default=Path("database-dump.sql"))
    subs.add_parser("integrity", help="run SQLite and foreign-key checks")
    subs.add_parser("vacuum", help="reclaim unused database pages")
    delete = subs.add_parser("delete", help="delete every row from one table")
    delete.add_argument("table")
    delete.add_argument("--yes", action="store_true")
    wipe = subs.add_parser("wipe", help="delete data from every application table")
    wipe.add_argument("--yes", action="store_true")
    wipe.add_argument("--include-migrations", action="store_true", help="also clear TypeORM migration metadata (unsafe)")
    return parser


def run(args: argparse.Namespace, manager: DatabaseManager) -> int:
    command = args.command
    if command is None:
        interactive_menu(manager)
    elif command == "info": manager.show_info()
    elif command == "tables": manager.show_tables(include_internal=args.internal)
    elif command == "schema": manager.show_schema(args.table)
    elif command == "foreign-keys": manager.show_foreign_keys(args.table)
    elif command == "stats": manager.show_statistics()
    elif command == "view": manager.view_table(args.table, limit=args.limit, offset=args.offset)
    elif command == "sql":
        statement = args.file.read_text(encoding="utf-8") if args.file else args.statement
        manager.execute_sql(statement, allow_write=args.write)
    elif command == "shell": manager.sql_shell()
    elif command == "backup": manager.backup(args.output)
    elif command == "backups": manager.list_backups()
    elif command == "restore":
        approved = args.yes or confirm(f"Replace {manager.path} with {args.source}?", "RESTORE DATABASE")
        if not approved:
            print("Restore cancelled.")
            return 2
        manager.restore(args.source)
    elif command == "export-json": manager.export_json(args.output)
    elif command == "dump-sql": manager.dump_sql(args.output)
    elif command == "integrity": return 0 if manager.integrity_check() else 1
    elif command == "vacuum": manager.vacuum()
    elif command == "delete":
        approved = args.yes or confirm(f"Delete every row from {args.table!r}?", f"DELETE {args.table}")
        if not approved:
            print("Delete cancelled.")
            return 2
        manager.delete_table_data(args.table)
    elif command == "wipe":
        phrase = "WIPE DATABASE INCLUDING MIGRATIONS" if args.include_migrations else "WIPE ALL DATA"
        approved = args.yes or confirm("Delete ALL selected data? A backup will be created.", phrase)
        if not approved:
            print("Wipe cancelled.")
            return 2
        manager.wipe(include_migrations=args.include_migrations)
    return 0


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    try:
        manager = DatabaseManager(args.database, create=args.create)
    except (FileNotFoundError, OSError, sqlite3.Error) as error:
        parser.error(str(error))
    try:
        return run(args, manager)
    except (ValueError, OSError, sqlite3.Error) as error:
        print(Style.paint(f"Error: {error}", Style.red), file=sys.stderr)
        return 1
    finally:
        manager.close()


if __name__ == "__main__":
    raise SystemExit(main())
