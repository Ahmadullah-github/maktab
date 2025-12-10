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
from typing import Any, Dict, List, Optional

import structlog

# Import core solver components
from core.solver import TimetableSolver
from models.input import TimetableData
from config.loader import ConfigLoader
from config.schema import SolverConfig

# Import decomposition solver for backward compatibility
from decomposition import DecompositionSolver

log = structlog.get_logger()


def solve_with_decomposition_if_beneficial(input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Solve using intelligent decomposition (maintains backward compatibility).
    
    This function replicates the behavior of the original solver_enhanced.py
    while using the new modular architecture internally.
    """
    try:
        # Load configuration
        config = ConfigLoader.load()
        
        # Validate input data using Pydantic models
        timetable_data = TimetableData(**input_data)
        
        # Check if decomposition is beneficial
        total_lessons = 0
        for cls in input_data.get('classes', []):
            for subject_req in cls.get('subjectRequirements', {}).values():
                total_lessons += subject_req.get('periodsPerWeek', 0)
        
        if total_lessons >= config.decomposition.threshold:
            log.info("Using decomposition solver for large problem", total_lessons=total_lessons)
            # Use decomposition solver for large problems (maintains existing logic)
            decomp_solver = DecompositionSolver(input_data, TimetableSolver)
            return decomp_solver.solve(input_data)
        else:
            log.info("Using direct solver for small problem", total_lessons=total_lessons)
            # Use the new modular solver
            solver = TimetableSolver(timetable_data)
            return solver.solve()
            
    except Exception as e:
        log.error("Error in solve_with_decomposition_if_beneficial", error=str(e), exc_info=True)
        return [{"error": str(e), "status": "ERROR"}]


def main():
    """Entry point: reads from stdin, solves, prints to stdout."""
    log.info("Python solver script started.")
    try:
        # Read input data with Unicode handling (maintains exact compatibility)
        log.info("Reading input data from stdin...")
        raw = sys.stdin.buffer.read()
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError:
            # try to unescape common double-escaped sequences
            text = raw.decode('utf-8', 'replace')
            log.warning("Unicode decode error encountered, using replacement characters")
        
        # If the string contains escaped unicode sequences like "\\u06...", unescape them
        if '\\u' in text:
            try:
                text = text.encode('utf-8').decode('unicode_escape')
                log.info("Unescaped Unicode sequences in input data")
            except Exception:
                log.warning("Could not unescape unicode sequences; continuing with best-effort decoding")
        
        input_data = json.loads(text)
        log.info("Input data received.", data_size=len(json.dumps(input_data)))
        
        # Validate input data structure
        if not isinstance(input_data, dict):
            raise ValueError("Input data must be a JSON object")
        
        # Check for required top-level keys
        required_keys = ['config', 'rooms', 'subjects', 'teachers', 'classes']
        missing_keys = [key for key in required_keys if key not in input_data]
        if missing_keys:
            raise ValueError(f"Missing required keys in input data: {missing_keys}")
        
        # Solve using intelligent decomposition (maintains backward compatibility)
        log.info("Initializing intelligent timetable solver...")
        log.info("Starting solve process with automatic decomposition detection...")
        
        solution = solve_with_decomposition_if_beneficial(input_data)
        
        # Report results (maintains exact output format)
        if solution and not solution[0].get('error'):
            log.info("Solution generated successfully.", solution_size=len(solution))
            # Print only JSON to stdout, no other text
            sys.stdout.write(json.dumps(solution, indent=2))
            sys.stdout.write('\n')
        else:
            log.warning("Solver completed with issues.", solution_status=solution[0] if solution else "No solution")
            # Print only JSON to stdout, no other text
            sys.stdout.write(json.dumps(solution, indent=2))
            sys.stdout.write('\n')
            
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON input: {str(e)}"
        log.error("JSON parsing failed.", error=error_msg, exc_info=True)
        print(json.dumps({"error": error_msg, "status": "INVALID_INPUT", "details": str(e)}), file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        error_msg = f"Data validation error: {str(e)}"
        log.error("Data validation failed.", error=error_msg, exc_info=True)
        print(json.dumps({"error": error_msg, "status": "VALIDATION_ERROR", "details": str(e)}), file=sys.stderr)
        sys.exit(1)
    except RuntimeError as e:
        error_str = str(e)
        # Check if the error message is already JSON
        try:
            error_data = json.loads(error_str)
            # It's already JSON, use it as-is
            error_data["status"] = "RUNTIME_ERROR"
            print(json.dumps(error_data, indent=2), file=sys.stderr)
        except json.JSONDecodeError:
            # It's a regular string, format it as before
            error_msg = f"Runtime error: {error_str}"
            log.error("Runtime error occurred.", error=error_msg, exc_info=True)
            print(json.dumps({"error": error_msg, "status": "RUNTIME_ERROR", "details": error_str}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        log.error("Solver script failed.", error=error_msg, exc_info=True)
        print(json.dumps({"error": error_msg, "status": "SOLVER_CRASH", "details": str(e)}), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Solver interrupted by user.")
        print(json.dumps({"error": "Solver interrupted by user", "status": "INTERRUPTED"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()