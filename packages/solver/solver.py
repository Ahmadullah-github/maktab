#!/usr/bin/env python3
# ==============================================================================
#
#  Timetable Solver Entry Point
#
#  Description:
#  Entry point for the refactored modular timetable solver. Maintains backward
#  compatibility with the stdin/stdout interface while using the new modular
#  architecture.
#
#  **Feature: solver-refactoring, Task 25.1**
#  **Requirements: 1.1, 1.8**
#
# ==============================================================================

import sys
import json
import traceback
import argparse
from typing import Any, Dict, Optional

# Setup logging FIRST before any other imports that use structlog
from config.logging import setup_logging, get_logger

setup_logging(debug=True)

# Import core solver components
from core.solver import TimetableSolver
from models.input import TimetableData
log = get_logger("solver.main")


def solve_with_decomposition_if_beneficial(
    input_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Solve through the canonical solver response contract.

    The legacy decomposition implementation consumes and returns lists of lessons,
    while TimetableSolver returns a structured SolverResponse dictionary. Mixing
    those contracts silently discarded large schedules, so decomposition remains
    disabled until it supports the canonical response format.
    """
    try:
        # Validate input data using Pydantic models
        timetable_data = TimetableData(**input_data)

        user_strategy = input_data.get("config", {}).get("strategy")

        total_lessons = 0
        for cls in input_data.get("classes", []):
            for subject_req in cls.get("subjectRequirements", {}).values():
                total_lessons += subject_req.get("periodsPerWeek", 0)

        log.info("Using canonical direct solver", total_lessons=total_lessons)
        solver = TimetableSolver(timetable_data)
        return solver.solve(user_strategy=user_strategy)

    except Exception as e:
        log.error(
            "Error in solve_with_decomposition_if_beneficial",
            error=str(e),
            exc_info=True,
        )
        return [{"error": str(e), "status": "ERROR"}]


def run_pre_solve_analysis(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run pre-solve analysis without generating a timetable.

    Returns a PreSolveResult with can_proceed, errors, warnings, suggestions.
    """
    from feedback.pre_solve_analyzer import PreSolveAnalyzer
    from models.input import TimetableData

    try:
        # Validate input data using Pydantic models
        timetable_data = TimetableData(**input_data)

        # Run pre-solve analysis
        analyzer = PreSolveAnalyzer(timetable_data)
        result = analyzer.analyze()

        # Convert to dict for JSON serialization
        return result.model_dump()
    except Exception as e:
        log.error("Pre-solve analysis failed", error=str(e), exc_info=True)
        return {
            "can_proceed": False,
            "errors": [
                {
                    "error_code": "ANALYSIS_ERROR",
                    "severity": "error",
                    "message_key": "error.analysis.failed",
                    "message_farsi": f"تحلیل پیش از حل با خطا مواجه شد: {str(e)}",
                    "message_english": f"Pre-solve analysis failed: {str(e)}",
                    "affected_entities": [],
                    "context": {"details": str(e)},
                }
            ],
            "warnings": [],
            "suggestions": [],
            "analysis_time_ms": 0,
        }


def main():
    """Entry point: reads from stdin, solves, prints to stdout."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Timetable Solver")
    parser.add_argument(
        "--analyze-only",
        action="store_true",
        help="Run pre-solve analysis only, without generating a timetable",
    )
    parser.add_argument(
        "--input-file", type=str, help="Read input from file instead of stdin"
    )
    args = parser.parse_args()

    log.info("=== SOLVER STARTED ===", analyze_only=args.analyze_only)
    try:
        # Read input data
        if args.input_file:
            log.info("Reading input from file...", path=args.input_file)
            with open(args.input_file, "r", encoding="utf-8") as f:
                text = f.read()
        else:
            log.info("Reading input from stdin...")
            raw = sys.stdin.buffer.read()
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                # try to unescape common double-escaped sequences
                text = raw.decode("utf-8", "replace")
                log.warning("Unicode decode error - using replacement characters")

        input_data = json.loads(text)
        log.info("Input parsed successfully", size_bytes=len(text))

        # If --analyze-only flag is set, run pre-solve analysis and exit
        if args.analyze_only:
            log.info("Running pre-solve analysis only")
            result = run_pre_solve_analysis(input_data)
            sys.stdout.write(json.dumps(result, indent=2, ensure_ascii=False))
            sys.stdout.write("\n")
            # Exit with code 0 even if can_proceed is False (analysis completed successfully)
            sys.exit(0)

        # === DEBUG: Log input summary ===
        config = input_data.get("config", {})
        teachers = input_data.get("teachers", [])
        subjects = input_data.get("subjects", [])
        classes = input_data.get("classes", [])
        rooms = input_data.get("rooms", [])
        fixed_assignments = input_data.get("fixedTeacherAssignments", [])

        log.info("=== INPUT SUMMARY ===")
        log.info(f"Teachers: {len(teachers)}")
        log.info(f"Subjects: {len(subjects)}")
        log.info(f"Classes: {len(classes)}")
        log.info(f"Rooms: {len(rooms)}")
        log.info(f"Fixed Assignments: {len(fixed_assignments)}")
        log.info(f"Days: {config.get('daysOfWeek', [])}")
        log.info(f"Periods/Day: {config.get('periodsPerDay', 'N/A')}")
        log.info(f"Strategy: {config.get('strategy', 'balanced')}")

        # Log teacher-subject mappings
        log.info("=== TEACHER-SUBJECT MAPPINGS ===")
        for t in teachers[:5]:  # First 5 teachers
            log.debug(
                f"Teacher '{t.get('fullName', t.get('id'))}' teaches subjects: {t.get('primarySubjectIds', [])}"
            )
        if len(teachers) > 5:
            log.debug(f"... and {len(teachers) - 5} more teachers")

        # Log class requirements
        log.info("=== CLASS REQUIREMENTS ===")
        for c in classes[:3]:  # First 3 classes
            reqs = c.get("subjectRequirements", {})
            total_periods = (
                sum(r.get("periodsPerWeek", 0) for r in reqs.values())
                if isinstance(reqs, dict)
                else 0
            )
            log.debug(
                f"Class '{c.get('name', c.get('id'))}': {len(reqs)} subjects, {total_periods} periods/week"
            )
        if len(classes) > 3:
            log.debug(f"... and {len(classes) - 3} more classes")

        # Validate input data structure
        if not isinstance(input_data, dict):
            raise ValueError("Input data must be a JSON object")

        # Check for required top-level keys
        required_keys = ["config", "rooms", "subjects", "teachers", "classes"]
        missing_keys = [key for key in required_keys if key not in input_data]
        if missing_keys:
            raise ValueError(f"Missing required keys: {missing_keys}")

        # Solve using intelligent decomposition
        log.info("=== STARTING SOLVER ===")
        solution = solve_with_decomposition_if_beneficial(input_data)

        # Check if solution is the new format (dict with 'status' key) or old format (list)
        if isinstance(solution, dict) and "status" in solution:
            # New format: SolverResponse dict
            status = solution.get("status")
            if status in ("success", "partial"):
                log.info(
                    "=== SOLUTION READY ===",
                    status=status,
                    data_keys=(
                        list(solution.get("data", {}).keys())
                        if solution.get("data")
                        else []
                    ),
                    warnings=len(solution.get("warnings", [])),
                )
                # Print only JSON to stdout
                sys.stdout.write(json.dumps(solution, indent=2, ensure_ascii=False))
                sys.stdout.write("\n")
            else:
                # Failed with new format
                errors = solution.get("errors", [])
                error_msg = (
                    errors[0].get("message_english", "Unknown error")
                    if errors
                    else "No solution"
                )
                log.error("=== SOLVER FAILED ===", error=error_msg)

                # Print error response to stdout (API reads stdout)
                sys.stdout.write(json.dumps(solution, indent=2, ensure_ascii=False))
                sys.stdout.write("\n")
                sys.exit(1)
        elif solution and len(solution) > 0 and not solution[0].get("error"):
            # Old format: list of lessons
            log.info("=== SOLUTION FOUND ===", lessons=len(solution))
            # Print only JSON to stdout
            sys.stdout.write(json.dumps(solution, indent=2))
            sys.stdout.write("\n")
        else:
            # Extract error details
            error_msg = "No solution"
            error_status = "NO_SOLUTION"
            cluster_errors = []

            if solution and len(solution) > 0:
                error_msg = solution[0].get("error", "Unknown error")
                error_status = solution[0].get("status", "SOLVER_ERROR")
                cluster_errors = solution[0].get("cluster_errors", [])

            log.error("=== SOLVER FAILED ===", error=error_msg)

            # Parse the error message to extract useful information
            # Common patterns: "No valid teachers or rooms for class 'X' (ID: Y), subject 'Z' (ID: W)"
            import re

            affected_entities = []
            error_code = "NO_FEASIBLE_SOLUTION"
            message_farsi = "امکان تولید جدول زمانی با محدودیت‌های فعلی وجود ندارد"
            suggestion_farsi = "لطفاً داده‌های ورودی را بررسی کنید"

            if "No valid teachers or rooms" in error_msg:
                error_code = "NO_VALID_RESOURCES"
                # Extract class and subject info from error message
                class_match = re.search(r"class '([^']+)' \(ID: (\d+)\)", error_msg)
                subject_match = re.search(r"subject '([^']+)' \(ID: (\d+)\)", error_msg)

                if class_match:
                    affected_entities.append(
                        {
                            "entity_type": "class",
                            "entity_id": class_match.group(2),
                            "entity_name": class_match.group(1),
                        }
                    )
                if subject_match:
                    affected_entities.append(
                        {
                            "entity_type": "subject",
                            "entity_id": subject_match.group(2),
                            "entity_name": subject_match.group(1),
                        }
                    )

                # Check for specific issues - look in cluster_errors for details
                has_room_issue = False
                room_type = "خاص"
                for ce in cluster_errors:
                    ce_error = ce.get("error", "")
                    if (
                        "Allowed rooms found: 0" in ce_error
                        or "room type:" in ce_error.lower()
                    ):
                        has_room_issue = True
                        room_type_match = re.search(
                            r"requires room type: ([^\n|]+)", ce_error
                        )
                        if room_type_match:
                            room_type = room_type_match.group(1).strip()
                        break

                if (
                    has_room_issue
                    or "Allowed rooms found: 0" in error_msg
                    or "room type:" in error_msg.lower()
                ):
                    room_type_match = re.search(
                        r"requires room type: ([^\n|]+)", error_msg
                    )
                    if room_type_match:
                        room_type = room_type_match.group(1).strip()
                    message_farsi = f"اتاق مناسب برای مضمون یافت نشد. این مضمون به اتاق نوع '{room_type}' نیاز دارد"
                    suggestion_farsi = f"لطفاً یک اتاق از نوع '{room_type}' اضافه کنید یا نوع اتاق مورد نیاز مضمون را تغییر دهید"
                elif "Allowed teachers found: 0" in error_msg:
                    message_farsi = "استاد مناسب برای تدریس این مضمون یافت نشد"
                    suggestion_farsi = "لطفاً یک استاد به این مضمون اختصاص دهید"
                else:
                    message_farsi = (
                        "منابع کافی (استاد یا اتاق) برای این صنف و مضمون یافت نشد"
                    )
                    suggestion_farsi = "لطفاً استادان و اتاق‌های موجود را بررسی کنید"

            # Build a proper error response for the API
            error_response = {
                "status": "failed",
                "data": None,
                "errors": [
                    {
                        "error_code": error_code,
                        "severity": "error",
                        "message_key": f"error.{error_code.lower()}",
                        "message_farsi": message_farsi,
                        "message_english": (
                            error_msg[:500] if len(error_msg) > 500 else error_msg
                        ),
                        "affected_entities": affected_entities,
                        "context": {
                            "suggestion_farsi": suggestion_farsi,
                            "suggestion_english": "Please check your input data",
                        },
                    }
                ],
                "warnings": [],
                "quality_score": None,
                "metadata": {},
            }
            # Print error response to stdout (API reads stdout)
            sys.stdout.write(json.dumps(error_response, indent=2, ensure_ascii=False))
            sys.stdout.write("\n")
            # Exit with error code so API knows it failed
            sys.exit(1)

    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON input: {str(e)}"
        log.error("JSON parsing failed", error=error_msg)
        print(
            json.dumps(
                {"error": error_msg, "status": "INVALID_INPUT", "details": str(e)}
            ),
            file=sys.stderr,
        )
        sys.exit(1)
    except ValueError as e:
        error_msg = f"Data validation error: {str(e)}"
        log.error("Validation failed", error=error_msg)
        print(
            json.dumps(
                {"error": error_msg, "status": "VALIDATION_ERROR", "details": str(e)}
            ),
            file=sys.stderr,
        )
        sys.exit(1)
    except RuntimeError as e:
        error_str = str(e)
        log.error("Runtime error", error=error_str)
        try:
            error_data = json.loads(error_str)
            error_data["status"] = "RUNTIME_ERROR"
            print(json.dumps(error_data, indent=2), file=sys.stderr)
        except json.JSONDecodeError:
            print(
                json.dumps(
                    {
                        "error": f"Runtime error: {error_str}",
                        "status": "RUNTIME_ERROR",
                        "details": error_str,
                    }
                ),
                file=sys.stderr,
            )
        sys.exit(1)
    except SystemExit as e:
        # SystemExit was raised - check if it's a success (0) or error (non-zero)
        exit_code = e.code if hasattr(e, "code") else 0

        if exit_code == 0:
            # Exit code 0 means success - this is normal for --analyze-only mode
            log.info("SystemExit with code 0 (success)")
            sys.exit(0)
        else:
            # Non-zero exit code is an error
            full_traceback = traceback.format_exc()
            log.error(
                "SystemExit raised with error code",
                exit_code=exit_code,
            )
            # Print full traceback to stderr for debugging
            print("=== FULL SYSTEMEXIT TRACEBACK ===", file=sys.stderr)
            print(full_traceback, file=sys.stderr)
            print("=== END TRACEBACK ===", file=sys.stderr)
            raise
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        full_traceback = traceback.format_exc()
        log.error("Solver crashed", error=error_msg, traceback=full_traceback)
        # Print full traceback to stderr for debugging
        print("=== FULL EXCEPTION TRACEBACK ===", file=sys.stderr)
        print(full_traceback, file=sys.stderr)
        print(f"=== Exception type: {type(e).__name__} ===", file=sys.stderr)
        print(f"=== Exception args: {e.args} ===", file=sys.stderr)
        print("=== END TRACEBACK ===", file=sys.stderr)
        print(
            json.dumps(
                {"error": error_msg, "status": "SOLVER_CRASH", "details": str(e)}
            ),
            file=sys.stderr,
        )
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Solver interrupted by user")
        print(
            json.dumps(
                {"error": "Solver interrupted by user", "status": "INTERRUPTED"}
            ),
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
