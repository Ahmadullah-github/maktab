import contextlib
import importlib.util
import io
import sqlite3
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "db_manager.py"
SPEC = importlib.util.spec_from_file_location("maktab_db_manager", MODULE_PATH)
assert SPEC and SPEC.loader
db_manager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(db_manager)


class DatabaseManagerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_dir.name) / "test.db"
        connection = sqlite3.connect(self.database)
        connection.executescript(
            """
            PRAGMA foreign_keys = ON;
            CREATE TABLE migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE parent (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
            CREATE TABLE child (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER NOT NULL REFERENCES parent(id)
            );
            INSERT INTO migrations VALUES (1, 'Baseline');
            INSERT INTO parent(name) VALUES ('one'), ('two');
            INSERT INTO child(parent_id) VALUES (1), (2);
            """
        )
        connection.close()
        self.manager = db_manager.DatabaseManager(self.database)

    def tearDown(self):
        self.manager.close()
        self.temp_dir.cleanup()

    def test_read_only_sql_allows_select_and_blocks_update(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.manager.execute_sql("SELECT name FROM parent ORDER BY id;")
        with self.assertRaises(sqlite3.OperationalError):
            self.manager.execute_sql("UPDATE parent SET name = 'changed';")
        value = self.manager.conn.execute(
            "SELECT name FROM parent WHERE id = 1"
        ).fetchone()[0]
        self.assertEqual(value, "one")

    def test_write_sql_requires_explicit_permission(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.manager.execute_sql(
                "UPDATE parent SET name = 'changed' WHERE id = 1;",
                allow_write=True,
            )
        value = self.manager.conn.execute(
            "SELECT name FROM parent WHERE id = 1"
        ).fetchone()[0]
        self.assertEqual(value, "changed")

    def test_wipe_deletes_data_but_preserves_migrations(self):
        with contextlib.redirect_stdout(io.StringIO()):
            deleted, backup = self.manager.wipe()
        self.assertEqual(deleted, 4)
        self.assertTrue(backup.exists())
        self.assertEqual(
            self.manager.conn.execute("SELECT COUNT(*) FROM parent").fetchone()[0], 0
        )
        self.assertEqual(
            self.manager.conn.execute("SELECT COUNT(*) FROM child").fetchone()[0], 0
        )
        self.assertEqual(
            self.manager.conn.execute("SELECT COUNT(*) FROM migrations").fetchone()[0],
            1,
        )

    def test_delete_table_creates_backup(self):
        with contextlib.redirect_stdout(io.StringIO()):
            deleted, backup = self.manager.delete_table_data("child")
        self.assertEqual(deleted, 2)
        self.assertTrue(backup.exists())

    def test_backup_and_restore_round_trip(self):
        with contextlib.redirect_stdout(io.StringIO()):
            backup = self.manager.backup()
            self.manager.execute_sql("DELETE FROM child;", allow_write=True)
            self.manager.restore(backup)
        self.assertEqual(
            self.manager.conn.execute("SELECT COUNT(*) FROM child").fetchone()[0], 2
        )


if __name__ == "__main__":
    unittest.main()
