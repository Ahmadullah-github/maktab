#!/usr/bin/env python3
"""
Database Manager CLI Tool (Python)
Comprehensive database management operations for Maktab
"""

import sqlite3
import json
import sys
import shutil
from datetime import datetime
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "timetable.db"


# ANSI color codes
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"


def log(message: str, color: str = Colors.RESET):
    print(f"{color}{message}{Colors.RESET}")


def print_header(title: str):
    print(f"\n{'=' * 60}")
    log(title, Colors.BOLD)
    print("=" * 60 + "\n")


def print_menu():
    print_header("📊 DATABASE MANAGER (Python)")
    log(f"Database: {DB_PATH}", Colors.CYAN)

    print("\nBASIC OPERATIONS:")
    print("  1.  📋 Show all tables")
    print("  2.  📊 Show table statistics")
    print("  3.  🔍 View table data")
    print("  4.  🗑️  Delete all records from a table")
    print("  5.  💾 Backup database")
    print("  6.  📥 List backups")

    print("\nADVANCED OPERATIONS:")
    print("  7.  🔬 Inspect wizard configuration")
    print("  8.  👥 List all teachers")
    print("  9.  📚 List all subjects")
    print("  10. 🏫 List all classes")
    print("  11. 🚪 List all rooms")
    print("  12. ⏰ Show periods configuration")
    print("  13. 🧪 Validate data integrity")
    print("  14. 📝 Export data to JSON")
    print("  15. 📥 Import data from JSON")
    print("  16. 🔍 Custom SQL query")
    print("  17. 📈 Generate statistics report")

    print("\nDANGEROUS OPERATIONS:")
    log("  99. 🔥 RESET ENTIRE DATABASE (delete all data)", Colors.RED)

    print("\n  0.  🚪 Exit\n")


class DatabaseManager:
    def __init__(self):
        if not DB_PATH.exists():
            log(
                "⚠️  Database does not exist. Will create on first write.", Colors.YELLOW
            )
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row

    def close(self):
        self.conn.close()

    def _get_wizard_data(self, key: str):
        """Helper to get parsed wizard data by key (legacy wizard_data table)"""
        try:
            cursor = self.conn.execute(
                "SELECT value FROM wizard_data WHERE key = ?", (key,)
            )
            row = cursor.fetchone()
            if row:
                try:
                    return json.loads(row["value"])
                except json.JSONDecodeError:
                    return row["value"]
        except sqlite3.OperationalError:
            pass  # Table doesn't exist
        return None

    def _table_exists(self, table_name: str) -> bool:
        """Check if a table exists"""
        cursor = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        )
        return cursor.fetchone() is not None

    def _parse_json_field(self, value):
        """Parse a JSON string field, handle double-encoded JSON"""
        if not value:
            return None
        try:
            parsed = json.loads(value)
            # Handle double-encoded JSON (string containing JSON)
            if isinstance(parsed, str):
                try:
                    return json.loads(parsed)
                except (json.JSONDecodeError, TypeError):
                    return parsed
            return parsed
        except (json.JSONDecodeError, TypeError):
            return value

    # Basic Operations
    def show_tables(self):
        print_header("📋 DATABASE TABLES")
        cursor = self.conn.execute(
            "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = cursor.fetchall()

        if not tables:
            log("No tables found", Colors.YELLOW)
            return

        for idx, table in enumerate(tables, 1):
            print(f"\n{idx}. {table['name']}")
            if table["sql"]:
                print("   Schema:")
                lines = table["sql"].split("\n")[1:-1]
                for line in lines:
                    print(f"   {line.strip()}")

        print(f"\nTotal: {len(tables)} tables")

    def show_statistics(self):
        print_header("📊 TABLE STATISTICS")
        cursor = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = cursor.fetchall()

        if not tables:
            log("No tables found", Colors.YELLOW)
            return

        print(f"{'Table':<30} {'Records':>8}   Size")
        print("-" * 60)

        total_records = 0
        for table in tables:
            try:
                count_cursor = self.conn.execute(
                    f'SELECT COUNT(*) as count FROM "{table["name"]}"'
                )
                count = count_cursor.fetchone()["count"]
                total_records += count
                size = f"~{count * 100} bytes" if count > 0 else "empty"
                print(f"{table['name']:<30} {count:>8}   {size}")
            except Exception as e:
                print(f"{table['name']:<30} ERROR: {e}")

        print("-" * 60)
        print(f"{'Total':<30} {total_records:>8}")

    def view_table_data(self, table_name: str):
        print_header(f"🔍 TABLE DATA: {table_name}")

        try:
            cursor = self.conn.execute(f'SELECT * FROM "{table_name}" LIMIT 100')
            rows = cursor.fetchall()

            if not rows:
                log("Table is empty", Colors.YELLOW)
                return

            print(f"Showing {len(rows)} records:\n")
            for idx, row in enumerate(rows, 1):
                print(f"Record {idx}:")
                for key in row.keys():
                    value = row[key]
                    if isinstance(value, str) and len(value) > 100:
                        value = value[:100] + "..."
                    print(f"  {key}: {value}")
                print()
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def delete_table_data(self, table_name: str):
        try:
            cursor = self.conn.execute(f'SELECT COUNT(*) as count FROM "{table_name}"')
            count = cursor.fetchone()["count"]

            if count == 0:
                log("Table is already empty", Colors.YELLOW)
                return

            self.conn.execute(f'DELETE FROM "{table_name}"')
            self.conn.commit()
            log(f"✅ Deleted {count} record(s) from {table_name}", Colors.GREEN)
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def backup_database(self):
        print_header("💾 BACKUP DATABASE")
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        backup_path = DB_PATH.with_suffix(f".backup.{timestamp}.db")

        try:
            shutil.copy2(DB_PATH, backup_path)
            log(f"✅ Backup created: {backup_path.name}", Colors.GREEN)
            log(f"   Location: {backup_path}", Colors.CYAN)
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def list_backups(self):
        print_header("📥 AVAILABLE BACKUPS")
        backup_dir = DB_PATH.parent
        backups = sorted(backup_dir.glob("*.backup.*.db"))

        if not backups:
            log("No backups found", Colors.YELLOW)
            return []

        print("Available backups:")
        for idx, backup in enumerate(backups, 1):
            size_kb = backup.stat().st_size / 1024
            print(f"  {idx}. {backup.name} ({size_kb:.2f} KB)")

        return backups

    # Advanced Operations
    def inspect_wizard_config(self):
        print_header("🔬 WIZARD CONFIGURATION")

        try:
            cursor = self.conn.execute("SELECT * FROM wizard_data")
            rows = cursor.fetchall()

            if not rows:
                log("No wizard data found", Colors.YELLOW)
                return

            for row in rows:
                print(f"\n{row['key']}:")
                try:
                    data = json.loads(row["value"])
                    if isinstance(data, list):
                        print(f"  Array with {len(data)} items")
                    elif isinstance(data, dict):
                        print(json.dumps(data, indent=2, ensure_ascii=False))
                    else:
                        print(f"  {data}")
                except json.JSONDecodeError:
                    print(f"  {row['value']}")
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def list_teachers(self):
        print_header("👥 TEACHERS")

        # Try entity table first
        if self._table_exists("teacher"):
            cursor = self.conn.execute(
                "SELECT * FROM teacher WHERE isDeleted = 0 ORDER BY id"
            )
            teachers = cursor.fetchall()

            if not teachers:
                log("No teachers found", Colors.YELLOW)
                return

            print(f"Total teachers: {len(teachers)}\n")

            for idx, teacher in enumerate(teachers, 1):
                name = teacher["fullName"]
                print(f"{idx}. {name} (ID: {teacher['id']})")

                # Show subjects
                primary_subjects = self._parse_json_field(teacher["primarySubjectIds"])
                if primary_subjects:
                    print(
                        f"   Primary subjects: {', '.join(map(str, primary_subjects))}"
                    )

                # Show limits
                print(
                    f"   Max periods/day: {teacher['maxPeriodsPerDay']}, Max/week: {teacher['maxPeriodsPerWeek']}"
                )

                # Show availability summary
                availability = self._parse_json_field(teacher["availability"])
                if availability and isinstance(availability, dict) and availability:
                    DAYS = [
                        "Saturday",
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                    ]
                    available_slots = 0
                    total_slots = 0

                    for day in DAYS:
                        day_avail = availability.get(day, [])
                        if day_avail:
                            total_slots += len(day_avail)
                            available_slots += sum(1 for x in day_avail if x)

                    if total_slots > 0:
                        percentage = available_slots / total_slots * 100
                        print(
                            f"   Availability: {available_slots}/{total_slots} periods ({percentage:.0f}%)"
                        )

                print()
            return

        # Fallback to wizard_data
        teachers = self._get_wizard_data("teachers")
        if not teachers:
            log("No teachers found", Colors.YELLOW)
            return

        print(f"Total teachers: {len(teachers)}\n")

        for idx, teacher in enumerate(teachers, 1):
            name = teacher.get("fullName") or teacher.get("name", "Unknown")
            print(f"{idx}. {name} (ID: {teacher.get('id')})")
            primary_subjects = teacher.get("primarySubjectIds", [])
            if primary_subjects:
                print(f"   Primary subjects: {', '.join(map(str, primary_subjects))}")
            print()

    def list_subjects(self):
        print_header("📚 SUBJECTS")

        # Try entity table first
        if self._table_exists("subject"):
            cursor = self.conn.execute(
                "SELECT * FROM subject WHERE isDeleted = 0 ORDER BY grade, name"
            )
            subjects = cursor.fetchall()

            if not subjects:
                log("No subjects found", Colors.YELLOW)
                return

            print(f"Total subjects: {len(subjects)}\n")

            # Group by grade
            by_grade = {}
            for subject in subjects:
                grade = subject["grade"] or "Unknown"
                if grade not in by_grade:
                    by_grade[grade] = []
                by_grade[grade].append(subject)

            for grade in sorted(by_grade.keys(), key=lambda x: (isinstance(x, str), x)):
                print(f"\nGrade {grade}:")
                for subject in by_grade[grade]:
                    periods = (
                        subject["periodsPerWeek"] if subject["periodsPerWeek"] else "?"
                    )
                    room_type = subject["requiredRoomType"] or ""
                    lab_icon = "🔬" if room_type and room_type != "classroom" else ""
                    print(f"  • {subject['name']} ({periods} periods/week) {lab_icon}")
            return

        # Fallback to wizard_data
        subjects = self._get_wizard_data("subjects")
        if not subjects:
            log("No subjects found", Colors.YELLOW)
            return

        print(f"Total subjects: {len(subjects)}\n")

        by_grade = {}
        for subject in subjects:
            grade = subject.get("grade", "Unknown")
            if grade not in by_grade:
                by_grade[grade] = []
            by_grade[grade].append(subject)

        for grade in sorted(by_grade.keys(), key=lambda x: (isinstance(x, str), x)):
            print(f"\nGrade {grade}:")
            for subject in by_grade[grade]:
                periods = subject.get("periodsPerWeek", "?")
                print(f"  • {subject.get('name')} ({periods} periods/week)")

    def list_classes(self):
        print_header("🏫 CLASSES")

        # Try entity table first (class_group)
        if self._table_exists("class_group"):
            cursor = self.conn.execute(
                "SELECT * FROM class_group WHERE isDeleted = 0 ORDER BY grade, name"
            )
            classes = cursor.fetchall()

            if not classes:
                log("No classes found", Colors.YELLOW)
                return

            print(f"Total classes: {len(classes)}\n")

            for idx, cls in enumerate(classes, 1):
                grade = cls["grade"] or "?"
                section = cls["section"] or ""
                section_str = f" [{section}]" if section else ""
                single_teacher = "👤" if cls["singleTeacherMode"] else ""
                print(
                    f"{idx}. {cls['name']} (Grade {grade}){section_str} {single_teacher}"
                )

                subject_reqs = self._parse_json_field(cls["subjectRequirements"])
                if subject_reqs and isinstance(subject_reqs, list):
                    total_periods = sum(
                        req.get("periodsPerWeek", 0) for req in subject_reqs
                    )
                    print(
                        f"   Subjects: {len(subject_reqs)}, Total periods: {total_periods}"
                    )

                if cls["fixedRoomId"]:
                    print(f"   Fixed room: {cls['fixedRoomId']}")

                print()
            return

        # Fallback to wizard_data
        classes = self._get_wizard_data("classes")
        if not classes:
            log("No classes found", Colors.YELLOW)
            return

        print(f"Total classes: {len(classes)}\n")

        for idx, cls in enumerate(classes, 1):
            grade = cls.get("gradeLevel") or cls.get("grade", "?")
            print(f"{idx}. {cls.get('name')} (Grade {grade})")

            subject_reqs = cls.get("subjectRequirements", [])
            if subject_reqs:
                total_periods = sum(
                    req.get("periodsPerWeek", 0) for req in subject_reqs
                )
                print(
                    f"   Subjects: {len(subject_reqs)}, Total periods: {total_periods}"
                )

            if cls.get("fixedRoomId"):
                print(f"   Fixed room: {cls['fixedRoomId']}")

            print()

    def list_rooms(self):
        print_header("🚪 ROOMS")

        # Try entity table first
        if self._table_exists("room"):
            cursor = self.conn.execute(
                "SELECT * FROM room WHERE isDeleted = 0 ORDER BY name"
            )
            rooms = cursor.fetchall()

            if not rooms:
                log("No rooms found", Colors.YELLOW)
                return

            print(f"Total rooms: {len(rooms)}\n")

            for idx, room in enumerate(rooms, 1):
                room_type = room["type"] or "general"
                capacity = room["capacity"] or "?"
                features = self._parse_json_field(room["features"])
                features_str = f" [{', '.join(features)}]" if features else ""
                print(
                    f"{idx}. {room['name']} (Type: {room_type}, Capacity: {capacity}){features_str}"
                )
            return

        # Fallback to wizard_data
        rooms = self._get_wizard_data("rooms")
        if not rooms:
            log("No rooms found", Colors.YELLOW)
            return

        print(f"Total rooms: {len(rooms)}\n")

        for idx, room in enumerate(rooms, 1):
            room_type = room.get("type", "general")
            capacity = room.get("capacity", "?")
            print(
                f"{idx}. {room.get('name')} (Type: {room_type}, Capacity: {capacity})"
            )

    def show_periods_config(self):
        print_header("⏰ PERIODS CONFIGURATION")

        # Try school_config table first
        if self._table_exists("school_config"):
            cursor = self.conn.execute("SELECT * FROM school_config LIMIT 1")
            config = cursor.fetchone()

            if config:
                print(f"School: {config['schoolName'] or 'Not set'}")
                print(f"Days per week: {config['daysPerWeek'] or 6}")
                print(f"Periods per day: {config['periodsPerDay'] or 6}")
                print(f"Period duration: {config['periodDuration'] or 45} minutes")
                print(
                    f"Dynamic periods: {'Yes' if config['dynamicPeriodsEnabled'] else 'No'}"
                )

                # Show days of week
                days_json = self._parse_json_field(config["daysOfWeekJson"])
                if days_json:
                    print(f"\n📅 Active days: {', '.join(days_json)}")

                # Show periods per day map
                periods_map = self._parse_json_field(config["periodsPerDayMapJson"])
                if periods_map and isinstance(periods_map, dict):
                    print("\n📅 Variable periods per day:")
                    total_weekly = 0
                    default_periods = (
                        config["defaultPeriodsPerDay"] or config["periodsPerDay"] or 6
                    )

                    for day, periods in periods_map.items():
                        total_weekly += periods
                        print(f"  {day:<10}: {periods} periods")

                    print(f"\nTotal weekly periods: {total_weekly}")

                # Show break periods
                breaks = self._parse_json_field(config["breakPeriods"])
                if breaks:
                    print("\n☕ Break periods:")
                    for bp in breaks:
                        print(
                            f"  After period {bp.get('afterPeriod')}: {bp.get('duration')} minutes"
                        )
                return

        # Fallback to wizard_data
        periods_info = self._get_wizard_data("periodsInfo")
        school_info = self._get_wizard_data("schoolInfo")

        if not periods_info or not school_info:
            log("Configuration not found", Colors.YELLOW)
            return

        days_per_week = school_info.get("daysPerWeek", 6)
        periods_per_day = periods_info.get("periodsPerDay", 6)

        print(f"Days per week: {days_per_week}")
        print(f"Periods per day (default): {periods_per_day}")
        print(
            f"Variable periods enabled: {'Yes' if school_info.get('variablePeriodsPerDay') else 'No'}"
        )

        periods_map = periods_info.get("periodsPerDayMap", {})
        if periods_map:
            print("\n📅 Variable periods per day:")
            DAYS = [
                "Saturday",
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
            ]
            total_weekly = 0

            for day in DAYS[:days_per_week]:
                day_periods = periods_map.get(day, periods_per_day)
                total_weekly += day_periods
                print(f"  {day:<10}: {day_periods} periods")

            print(f"\nTotal weekly periods: {total_weekly}")

        break_periods = school_info.get("breakPeriods", [])
        if break_periods:
            print("\n☕ Break periods:")
            for bp in break_periods:
                print(
                    f"  After period {bp.get('afterPeriod')}: {bp.get('duration')} minutes"
                )

    def validate_data_integrity(self):
        print_header("🧪 DATA INTEGRITY CHECK")

        issues = []

        try:
            # Check tables
            cursor = self.conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = [t["name"] for t in cursor.fetchall()]
            log(f"✓ Found {len(tables)} tables", Colors.GREEN)

            # Check for entity tables
            entity_tables = [
                "teacher",
                "subject",
                "class_group",
                "room",
                "school_config",
            ]
            for table in entity_tables:
                if table in tables:
                    log(f"✓ Entity table '{table}' exists", Colors.GREEN)
                else:
                    issues.append(f"Missing entity table: {table}")

            # Validate teachers
            if "teacher" in tables:
                cursor = self.conn.execute("SELECT * FROM teacher WHERE isDeleted = 0")
                teachers = cursor.fetchall()
                log(f"✓ Found {len(teachers)} active teachers", Colors.GREEN)

                for teacher in teachers:
                    # Check for valid subject IDs
                    primary_ids = self._parse_json_field(teacher["primarySubjectIds"])
                    if not primary_ids:
                        issues.append(
                            f"Teacher '{teacher['fullName']}' has no primary subjects"
                        )

            # Validate subjects
            if "subject" in tables:
                cursor = self.conn.execute("SELECT * FROM subject WHERE isDeleted = 0")
                subjects = cursor.fetchall()
                log(f"✓ Found {len(subjects)} active subjects", Colors.GREEN)

            # Validate classes
            if "class_group" in tables:
                cursor = self.conn.execute(
                    "SELECT * FROM class_group WHERE isDeleted = 0"
                )
                classes = cursor.fetchall()
                log(f"✓ Found {len(classes)} active classes", Colors.GREEN)

                for cls in classes:
                    reqs = self._parse_json_field(cls["subjectRequirements"])
                    if not reqs:
                        issues.append(
                            f"Class '{cls['name']}' has no subject requirements"
                        )

            # Validate rooms
            if "room" in tables:
                cursor = self.conn.execute("SELECT * FROM room WHERE isDeleted = 0")
                rooms = cursor.fetchall()
                log(f"✓ Found {len(rooms)} active rooms", Colors.GREEN)

            # Show results
            print()
            if not issues:
                log("✅ No integrity issues found!", Colors.GREEN)
            else:
                log(f"⚠️  Found {len(issues)} issue(s):", Colors.YELLOW)
                for idx, issue in enumerate(issues, 1):
                    print(f"  {idx}. {issue}")

        except Exception as e:
            log(f"Error during validation: {e}", Colors.RED)

    def export_to_json(self, filename: str = "database-export.json"):
        print_header("📝 EXPORT DATA")

        try:
            export_data = {}

            # Export entity tables
            entity_tables = [
                ("teacher", "teachers"),
                ("subject", "subjects"),
                ("class_group", "classes"),
                ("room", "rooms"),
                ("school_config", "schoolConfig"),
            ]

            for table_name, key in entity_tables:
                if self._table_exists(table_name):
                    cursor = self.conn.execute(f"SELECT * FROM {table_name}")
                    rows = cursor.fetchall()
                    export_data[key] = [dict(row) for row in rows]
                    log(f"✓ Exported {len(rows)} {key}", Colors.GREEN)

            # Also try wizard_data if it exists
            if self._table_exists("wizard_data"):
                cursor = self.conn.execute("SELECT * FROM wizard_data")
                rows = cursor.fetchall()
                for row in rows:
                    try:
                        export_data[f"wizard_{row['key']}"] = json.loads(row["value"])
                    except json.JSONDecodeError:
                        export_data[f"wizard_{row['key']}"] = row["value"]

            export_path = DB_PATH.parent / filename
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False, default=str)

            size_kb = export_path.stat().st_size / 1024
            log(f"✅ Data exported to: {export_path}", Colors.GREEN)
            log(f"   Size: {size_kb:.2f} KB", Colors.CYAN)
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def import_from_json(self, filename: str):
        print_header("📥 IMPORT DATA")

        import_path = DB_PATH.parent / filename
        if not import_path.exists():
            log(f"File not found: {import_path}", Colors.RED)
            return

        try:
            with open(import_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for key, value in data.items():
                json_value = (
                    json.dumps(value, ensure_ascii=False)
                    if not isinstance(value, str)
                    else value
                )
                self.conn.execute(
                    "INSERT OR REPLACE INTO wizard_data (key, value) VALUES (?, ?)",
                    (key, json_value),
                )

            self.conn.commit()
            log(f"✅ Imported {len(data)} entries from {filename}", Colors.GREEN)
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def custom_query(self, query: str):
        print_header("🔍 CUSTOM SQL QUERY")

        try:
            is_select = query.strip().lower().startswith("select")

            if is_select:
                cursor = self.conn.execute(query)
                results = cursor.fetchall()
                print(f"\nResults: {len(results)} row(s)\n")

                if results:
                    for idx, row in enumerate(results, 1):
                        print(f"Row {idx}:")
                        for key in row.keys():
                            print(f"  {key}: {row[key]}")
                        print()
            else:
                cursor = self.conn.execute(query)
                self.conn.commit()
                log(f"✅ Query executed. Changes: {cursor.rowcount}", Colors.GREEN)
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def generate_report(self):
        print_header("📈 STATISTICS REPORT")

        try:
            report = {}

            # Tables
            cursor = self.conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            report["tables"] = len(cursor.fetchall())

            # Try entity tables first
            if self._table_exists("teacher"):
                cursor = self.conn.execute(
                    "SELECT COUNT(*) as c FROM teacher WHERE isDeleted = 0"
                )
                report["teachers"] = cursor.fetchone()["c"]
            else:
                teachers = self._get_wizard_data("teachers")
                report["teachers"] = len(teachers) if teachers else 0

            if self._table_exists("subject"):
                cursor = self.conn.execute(
                    "SELECT COUNT(*) as c FROM subject WHERE isDeleted = 0"
                )
                report["subjects"] = cursor.fetchone()["c"]
            else:
                subjects = self._get_wizard_data("subjects")
                report["subjects"] = len(subjects) if subjects else 0

            if self._table_exists("class_group"):
                cursor = self.conn.execute(
                    "SELECT COUNT(*) as c FROM class_group WHERE isDeleted = 0"
                )
                report["classes"] = cursor.fetchone()["c"]

                # Calculate total lessons from class_group
                cursor = self.conn.execute(
                    "SELECT subjectRequirements FROM class_group WHERE isDeleted = 0"
                )
                total_lessons = 0
                for row in cursor.fetchall():
                    reqs = self._parse_json_field(row["subjectRequirements"])
                    if reqs and isinstance(reqs, list):
                        total_lessons += sum(r.get("periodsPerWeek", 0) for r in reqs)
                report["total_lessons"] = total_lessons
            else:
                classes = self._get_wizard_data("classes")
                report["classes"] = len(classes) if classes else 0
                if classes:
                    report["total_lessons"] = sum(
                        sum(
                            req.get("periodsPerWeek", 0)
                            for req in cls.get("subjectRequirements", [])
                        )
                        for cls in classes
                    )
                else:
                    report["total_lessons"] = 0

            if self._table_exists("room"):
                cursor = self.conn.execute(
                    "SELECT COUNT(*) as c FROM room WHERE isDeleted = 0"
                )
                report["rooms"] = cursor.fetchone()["c"]
            else:
                rooms = self._get_wizard_data("rooms")
                report["rooms"] = len(rooms) if rooms else 0

            # Display
            print("Database Statistics:")
            print("-" * 40)
            print(f"Tables:              {report['tables']}")
            print(f"Teachers:            {report['teachers']}")
            print(f"Subjects:            {report['subjects']}")
            print(f"Classes:             {report['classes']}")
            print(f"Rooms:               {report['rooms']}")
            print(f"Total lesson slots:  {report['total_lessons']}")

            # Database size
            if DB_PATH.exists():
                size_kb = DB_PATH.stat().st_size / 1024
                print(f"Database size:       {size_kb:.2f} KB")
            print("-" * 40)

        except Exception as e:
            log(f"Error: {e}", Colors.RED)

    def reset_database(self):
        """Delete all data from all tables"""
        cursor = self.conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        for table in tables:
            self.conn.execute(f'DELETE FROM "{table["name"]}"')

        self.conn.commit()
        log("✅ All data deleted", Colors.GREEN)


def run_command(manager: DatabaseManager, command: str, args: list):
    """Run a single command (for CLI mode)"""
    commands = {
        "tables": manager.show_tables,
        "stats": manager.show_statistics,
        "teachers": manager.list_teachers,
        "subjects": manager.list_subjects,
        "classes": manager.list_classes,
        "rooms": manager.list_rooms,
        "config": manager.inspect_wizard_config,
        "periods": manager.show_periods_config,
        "validate": manager.validate_data_integrity,
        "report": manager.generate_report,
    }

    if command in commands:
        commands[command]()
    elif command == "export":
        filename = args[0] if args else "database-export.json"
        manager.export_to_json(filename)
    elif command == "import":
        if args:
            manager.import_from_json(args[0])
        else:
            log("Usage: import <filename>", Colors.RED)
    elif command == "query":
        if args:
            manager.custom_query(" ".join(args))
        else:
            log("Usage: query <SQL>", Colors.RED)
    elif command == "view":
        if args:
            manager.view_table_data(args[0])
        else:
            log("Usage: view <table_name>", Colors.RED)
    elif command == "backup":
        manager.backup_database()
    elif command == "backups":
        manager.list_backups()
    else:
        print("Unknown command. Available commands:")
        print("  tables, stats, teachers, subjects, classes, rooms, config,")
        print(
            "  periods, validate, report, export, import, query, view, backup, backups"
        )


def interactive_mode(manager: DatabaseManager):
    """Run interactive menu mode"""
    while True:
        print_menu()
        try:
            choice = input("Enter your choice: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            log("Goodbye! 👋", Colors.CYAN)
            break

        print()

        try:
            if choice == "1":
                manager.show_tables()
            elif choice == "2":
                manager.show_statistics()
            elif choice == "3":
                table_name = input("Enter table name: ").strip()
                manager.view_table_data(table_name)
            elif choice == "4":
                table_name = input("Enter table name: ").strip()
                confirm = input(
                    f"⚠️  Delete all records from {table_name}? (yes/no): "
                ).strip()
                if confirm.lower() == "yes":
                    manager.delete_table_data(table_name)
            elif choice == "5":
                manager.backup_database()
            elif choice == "6":
                manager.list_backups()
            elif choice == "7":
                manager.inspect_wizard_config()
            elif choice == "8":
                manager.list_teachers()
            elif choice == "9":
                manager.list_subjects()
            elif choice == "10":
                manager.list_classes()
            elif choice == "11":
                manager.list_rooms()
            elif choice == "12":
                manager.show_periods_config()
            elif choice == "13":
                manager.validate_data_integrity()
            elif choice == "14":
                filename = input(
                    "Export filename (default: database-export.json): "
                ).strip()
                manager.export_to_json(filename or "database-export.json")
            elif choice == "15":
                filename = input("Import filename: ").strip()
                if filename:
                    manager.import_from_json(filename)
            elif choice == "16":
                query = input("Enter SQL query: ").strip()
                if query:
                    manager.custom_query(query)
            elif choice == "17":
                manager.generate_report()
            elif choice == "99":
                log("⚠️  This will delete ALL data!", Colors.RED)
                confirm = input('Type "DELETE ALL DATA" to confirm: ').strip()
                if confirm == "DELETE ALL DATA":
                    manager.reset_database()
                else:
                    log("Reset cancelled", Colors.YELLOW)
            elif choice == "0":
                log("Goodbye! 👋", Colors.CYAN)
                break
            else:
                log("Invalid choice", Colors.RED)
        except Exception as e:
            log(f"Error: {e}", Colors.RED)

        if choice != "0":
            try:
                input("\nPress Enter to continue...")
            except (EOFError, KeyboardInterrupt):
                print()
                break


def main():
    args = sys.argv[1:]
    manager = DatabaseManager()

    try:
        if args:
            # CLI mode
            run_command(manager, args[0], args[1:])
        else:
            # Interactive mode
            interactive_mode(manager)
    finally:
        manager.close()


if __name__ == "__main__":
    main()
