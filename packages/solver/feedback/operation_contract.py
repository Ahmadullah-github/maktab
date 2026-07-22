"""Public, language-neutral operation contract emitted by the solver process.

The solver may use richer internal response models, but stdout always contains one
versioned envelope built here. Human-facing prose is intentionally excluded; the
renderer owns localization and uses stable issue codes plus structured parameters.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Iterable, List, Mapping, Optional


CONTRACT_VERSION = 1


_CATEGORY_BY_CODE: Dict[str, str] = {
    "ASSIGNMENT_READINESS_FAILED": "assignment",
    "CLASS_PERIOD_SHORTAGE": "class",
    "EMPTY_PERIODS_ERROR": "class",
    "FIXED_ROOM_INCOMPATIBLE": "room",
    "INVALID_CATEGORY": "configuration",
    "INVALID_GENERATED_PERIOD_BOUNDS": "configuration",
    "INVALID_GENERATED_TIMETABLE": "solver",
    "MISSING_ROOM_TYPE": "room",
    "NO_CLASSES": "class",
    "NO_FEASIBLE_SOLUTION": "solver",
    "NO_QUALIFIED_TEACHER": "teacher",
    "NO_ROOMS": "room",
    "NO_SUBJECTS": "subject",
    "NO_TEACHERS": "teacher",
    "NO_VALID_RESOURCES": "assignment",
    "OVER_ALLOCATION_ERROR": "class",
    "PERIOD_CONFIG_MISSING_DAY": "configuration",
    "PERIOD_CONFIG_OUT_OF_RANGE": "configuration",
    "ROOM_CAPACITY_WARNING": "room",
    "ROOM_CONFLICT": "room",
    "SUBJECT_CONSECUTIVE_WARNING": "subject",
    "SUBJECT_DAILY_LIMIT_INFEASIBLE": "subject",
    "SUBJECT_DISTRIBUTION_WARNING": "subject",
    "TEACHER_AVAILABILITY_CONFLICT": "teacher",
    "TEACHER_OVERLOAD": "teacher",
    "TEACHER_OVERLOAD_PREDICTED": "teacher",
    "TOTAL_PERIODS_MISMATCH": "configuration",
    "VALIDATION_ERROR": "configuration",
}

_RETRYABLE_CODES = {"SOLVER_TIMEOUT", "SOLVER_BUSY"}
_PRIVATE_PARAMETER_KEYS = {
    "debug",
    "error",
    "exception",
    "raw_error",
    "stderr",
    "stdout",
    "traceback",
}


def _json_value(value: Any) -> Any:
    """Convert Pydantic/Enum values into JSON-safe contract parameters."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Mapping):
        return {
            str(key): _json_value(item)
            for key, item in value.items()
            if str(key).lower() not in _PRIVATE_PARAMETER_KEYS
            and (
                not str(key).lower().startswith("message_")
                or str(key).lower() in {"message_key", "message_params"}
            )
            and (
                not str(key).lower().startswith("suggestion_")
                or str(key).lower() == "suggestion_code"
            )
        }
    if isinstance(value, (list, tuple, set)):
        return [_json_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def issue_category(code: str) -> str:
    if code in _CATEGORY_BY_CODE:
        return _CATEGORY_BY_CODE[code]
    if code.startswith("TEACHER_"):
        return "teacher"
    if code.startswith("CLASS_"):
        return "class"
    if code.startswith("SUBJECT_"):
        return "subject"
    if code.startswith("ROOM_") or code.startswith("MISSING_ROOM"):
        return "room"
    if code.startswith("ASSIGNMENT_"):
        return "assignment"
    if code.startswith("SOLVER_") or code == "NO_FEASIBLE_SOLUTION":
        return "solver"
    if code in {"INTERNAL_ERROR", "ANALYSIS_ERROR"}:
        return "system"
    return "configuration"


def issue_from_solver_detail(detail: Mapping[str, Any], phase: str) -> Dict[str, Any]:
    code = str(detail.get("error_code") or "UNKNOWN_ERROR")
    severity = str(detail.get("severity") or "error")
    if severity not in {"error", "warning", "info"}:
        severity = "error"

    entities: List[Dict[str, str]] = []
    for entity in detail.get("affected_entities") or []:
        if not isinstance(entity, Mapping):
            continue
        entity_type = str(entity.get("entity_type") or "")
        entity_id = str(entity.get("entity_id") or "")
        if entity_type not in {"teacher", "class", "subject", "room"} or not entity_id:
            continue
        item = {"type": entity_type, "id": entity_id}
        if entity.get("entity_name") is not None:
            item["name"] = str(entity["entity_name"])
        entities.append(item)

    context = detail.get("context") if isinstance(detail.get("context"), Mapping) else {}
    return {
        "code": code,
        "severity": severity,
        "category": issue_category(code),
        "phase": phase,
        "blocking": severity == "error",
        "retryable": code in _RETRYABLE_CODES,
        "messageParams": _json_value(context),
        "affectedEntities": entities,
    }


def issues_from_solver_details(
    details: Optional[Iterable[Mapping[str, Any]]], phase: str
) -> List[Dict[str, Any]]:
    return [issue_from_solver_detail(detail, phase) for detail in details or []]


def validation_issue(error: Exception) -> Dict[str, Any]:
    field_issues: List[Dict[str, Any]] = []
    errors = getattr(error, "errors", None)
    if callable(errors):
        for item in errors():
            location = item.get("loc") or []
            field_issues.append(
                {
                    "path": ".".join(str(part) for part in location) or "_root",
                    "code": str(item.get("type") or "invalid_value").upper(),
                    "params": _json_value(item.get("ctx") or {}),
                }
            )

    issue: Dict[str, Any] = {
        "code": "VALIDATION_ERROR",
        "severity": "error",
        "category": "configuration",
        "phase": "request",
        "blocking": True,
        "retryable": False,
        "messageParams": {"fieldCount": max(1, len(field_issues))},
        "affectedEntities": [],
    }
    if field_issues:
        issue["fieldIssues"] = field_issues
    return issue


def simple_issue(
    code: str,
    phase: str,
    *,
    severity: str = "error",
    retryable: Optional[bool] = None,
    message_params: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "category": issue_category(code),
        "phase": phase,
        "blocking": severity == "error",
        "retryable": code in _RETRYABLE_CODES if retryable is None else retryable,
        "messageParams": _json_value(message_params or {}),
        "affectedEntities": [],
    }


def operation_response(
    outcome: str,
    *,
    data: Any = None,
    issues: Optional[List[Dict[str, Any]]] = None,
    metadata: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "contractVersion": CONTRACT_VERSION,
        "outcome": outcome,
        # Failed operations expose issues and diagnostic metadata only. Keeping
        # success-domain data null makes the contract safe for every consumer.
        "data": None if outcome == "failed" else _json_value(data),
        "issues": issues or [],
        "diagnosticId": "solver-process",
        "metadata": _json_value(metadata or {}),
    }


def from_solver_response(response: Mapping[str, Any]) -> Dict[str, Any]:
    status_value = response.get("status", "failed")
    outcome = status_value.value if isinstance(status_value, Enum) else str(status_value)
    if outcome not in {"success", "partial", "failed"}:
        outcome = "failed"

    issues = issues_from_solver_details(response.get("errors"), "solving")
    issues.extend(issues_from_solver_details(response.get("warnings"), "solving"))
    metadata = dict(response.get("metadata") or {})
    if response.get("quality_score") is not None:
        metadata["qualityScore"] = response["quality_score"]
    return operation_response(outcome, data=response.get("data"), issues=issues, metadata=metadata)


def from_pre_solve_response(response: Mapping[str, Any]) -> Dict[str, Any]:
    can_proceed = bool(response.get("can_proceed"))
    issues = issues_from_solver_details(response.get("errors"), "analysis")
    issues.extend(issues_from_solver_details(response.get("warnings"), "analysis"))
    suggestions = []
    for suggestion in response.get("suggestions") or []:
        if not isinstance(suggestion, Mapping):
            continue
        suggestions.append(
            {
                "code": str(suggestion.get("suggestion_code") or "UNKNOWN_SUGGESTION"),
                "messageParams": _json_value(suggestion.get("message_params") or {}),
                "expectedImprovement": suggestion.get("expected_improvement") or 0,
            }
        )

    analysis_data = {
        "canProceed": can_proceed,
        "analysisTimeMs": int(response.get("analysis_time_ms") or 0),
        "suggestions": suggestions,
    }

    return operation_response(
        "success" if can_proceed else "failed",
        data=analysis_data,
        issues=issues,
        metadata={} if can_proceed else {"analysis": analysis_data},
    )
