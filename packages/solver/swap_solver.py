#!/usr/bin/env python3
# ==============================================================================
#
#  Swap Solver - Entry Point for Swap Validation
#
#  Description:
#  Standalone entry point for swap validation. Reads JSON from stdin,
#  validates the swap using SwapValidator, and writes result to stdout.
#
#  Usage:
#    echo '{"swapRequest": {...}, "constraintData": {...}}' | python swap_solver.py
#
# ==============================================================================

import json
import sys
import logging
import structlog

from models.swap import SwapRequest, SwapResolution
from core.swap_validator import SwapValidator

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


def main():
    """
    Entry point for swap solver.
    Reads JSON from stdin, writes result to stdout.
    """
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        log.info("Swap solver started", has_swap_request="swapRequest" in input_data)

        # Parse swap request
        swap_request = SwapRequest(**input_data["swapRequest"])
        constraint_data = input_data["constraintData"]

        # Create validator and validate swap
        validator = SwapValidator(constraint_data)
        result = validator.validate_swap(swap_request)

        # Output result as JSON
        output = result.model_dump()
        print(json.dumps(output))

        log.info(
            "Swap solver completed successfully",
            is_valid=result.is_valid,
            errors=len(result.errors),
            warnings=len(result.warnings),
            total_moves=result.total_moves,
        )

        sys.exit(0)

    except KeyError as e:
        log.error("Missing required field in input", field=str(e))
        error_result = {
            "is_valid": False,
            "can_proceed_with_warning": False,
            "errors": [
                {
                    "type": "INVALID_INPUT",
                    "severity": "hard",
                    "message": f"Missing required field: {str(e)}",
                    "message_farsi": f"فیلد مورد نیاز وجود ندارد: {str(e)}",
                    "details": {"field": str(e)},
                }
            ],
            "warnings": [],
            "affected_lessons": [],
            "total_moves": 0,
            "solve_time_ms": 0,
        }
        print(json.dumps(error_result))
        sys.exit(1)

    except Exception as e:
        log.error("Swap solver error", error=str(e), exc_info=True)
        error_result = {
            "is_valid": False,
            "can_proceed_with_warning": False,
            "errors": [
                {
                    "type": "SOLVER_ERROR",
                    "severity": "hard",
                    "message": str(e),
                    "message_farsi": f"خطای حل‌کننده: {str(e)}",
                    "details": {"error": str(e)},
                }
            ],
            "warnings": [],
            "affected_lessons": [],
            "total_moves": 0,
            "solve_time_ms": 0,
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
