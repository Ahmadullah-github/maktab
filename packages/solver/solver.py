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
from pydantic import ValidationError

# Setup logging FIRST before any other imports that use structlog
from config.logging import setup_logging, get_logger

setup_logging(debug=True)

# Import core solver components
from core.solver import TimetableSolver
from feedback.operation_contract import (
    from_pre_solve_response,
    from_solver_response,
    operation_response,
    simple_issue,
    validation_issue,
)
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

    except ValidationError as e:
        log.warning("Solver input validation failed", field_count=len(e.errors()))
        return operation_response("failed", issues=[validation_issue(e)])
    except Exception as e:
        log.error(
            "Error in solve_with_decomposition_if_beneficial",
            error=str(e),
            exc_info=True,
        )
        return operation_response(
            "failed",
            issues=[simple_issue("INTERNAL_ERROR", "solving")],
        )


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

        return from_pre_solve_response(result.model_dump())
    except ValidationError as e:
        log.warning("Pre-solve input validation failed", field_count=len(e.errors()))
        return operation_response("failed", issues=[validation_issue(e)])
    except Exception as e:
        log.error("Pre-solve analysis failed", error=str(e), exc_info=True)
        return operation_response(
            "failed",
            issues=[simple_issue("ANALYSIS_ERROR", "analysis")],
        )


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
    parser.add_argument(
        "--swap",
        action="store_true",
        help="Run the lesson-swap validation protocol",
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

        if args.swap:
            from swap_solver import run_swap_operation

            result = run_swap_operation(input_data)
            sys.stdout.write(json.dumps(result.model_dump(), ensure_ascii=False))
            sys.stdout.write("\n")
            sys.exit(0)

        # If --analyze-only flag is set, run pre-solve analysis and exit
        if args.analyze_only:
            log.info("Running pre-solve analysis only")
            result = run_pre_solve_analysis(input_data)
            sys.stdout.write(json.dumps(result, indent=2, ensure_ascii=False))
            sys.stdout.write("\n")
            sys.exit(0 if result["outcome"] == "success" else 1)

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

        if isinstance(solution, dict) and solution.get("contractVersion") == 1:
            response = solution
        elif isinstance(solution, dict) and "status" in solution:
            response = from_solver_response(solution)
        else:
            log.error("Solver returned a legacy or malformed response")
            response = operation_response(
                "failed",
                issues=[simple_issue("SOLVER_PROTOCOL_ERROR", "solving")],
            )

        log.info(
            "=== SOLVER FINISHED ===",
            outcome=response["outcome"],
            issue_count=len(response["issues"]),
        )
        sys.stdout.write(json.dumps(response, indent=2, ensure_ascii=False))
        sys.stdout.write("\n")
        if response["outcome"] == "failed":
            sys.exit(1)

    except json.JSONDecodeError as e:
        log.error("JSON parsing failed", error=str(e))
        sys.stdout.write(
            json.dumps(
                operation_response(
                    "failed",
                    issues=[simple_issue("INVALID_JSON_INPUT", "request")],
                ),
                ensure_ascii=False,
            )
            + "\n"
        )
        sys.exit(1)
    except ValueError as e:
        log.error("Validation failed", error=str(e))
        sys.stdout.write(
            json.dumps(
                operation_response(
                    "failed",
                    issues=[simple_issue("VALIDATION_ERROR", "request")],
                ),
                ensure_ascii=False,
            )
            + "\n"
        )
        sys.exit(1)
    except RuntimeError as e:
        error_str = str(e)
        log.error("Runtime error", error=error_str)
        sys.stdout.write(
            json.dumps(
                operation_response(
                    "failed",
                    issues=[simple_issue("SOLVER_RUNTIME_ERROR", "solving")],
                ),
                ensure_ascii=False,
            )
            + "\n"
        )
        sys.exit(1)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        full_traceback = traceback.format_exc()
        log.error("Solver crashed", error=error_msg, traceback=full_traceback)
        sys.stdout.write(
            json.dumps(
                operation_response(
                    "failed",
                    issues=[simple_issue("INTERNAL_ERROR", "solving")],
                ),
                ensure_ascii=False,
            )
            + "\n"
        )
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Solver interrupted by user")
        sys.stdout.write(
            json.dumps(
                operation_response(
                    "failed",
                    issues=[simple_issue("SOLVER_CANCELLED", "solving")],
                ),
                ensure_ascii=False,
            )
            + "\n"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
