from feedback.operation_contract import (
    from_pre_solve_response,
    from_solver_response,
    validation_issue,
)


def test_solver_response_becomes_localization_free_operation_envelope():
    response = from_solver_response(
        {
            "status": "failed",
            "data": None,
            "errors": [
                {
                    "error_code": "TEACHER_OVERLOAD",
                    "severity": "error",
                    "message_farsi": "private prose",
                    "message_english": "private prose",
                    "affected_entities": [
                        {
                            "entity_type": "teacher",
                            "entity_id": "12",
                            "entity_name": "Amina",
                        }
                    ],
                    "context": {
                        "requiredPeriods": 30,
                        "availablePeriods": 20,
                        "suggestion_farsi": "private prose",
                        "traceback": "private diagnostics",
                    },
                }
            ],
            "warnings": [],
            "metadata": {"solve_time_seconds": 1.5},
        }
    )

    assert response["contractVersion"] == 1
    assert response["outcome"] == "failed"
    assert response["diagnosticId"] == "solver-process"
    issue = response["issues"][0]
    assert issue["code"] == "TEACHER_OVERLOAD"
    assert issue["category"] == "teacher"
    assert issue["messageParams"] == {"requiredPeriods": 30, "availablePeriods": 20}
    assert issue["affectedEntities"] == [{"type": "teacher", "id": "12", "name": "Amina"}]
    assert "private prose" not in str(response)
    assert "private diagnostics" not in str(response)


def test_quality_suggestions_keep_stable_codes_and_translation_parameters():
    response = from_solver_response(
        {
            "status": "success",
            "data": {"schedule": [], "metadata": {}, "statistics": {}},
            "errors": [],
            "warnings": [],
            "quality_score": {
                "overall": 81,
                "suggestions": [
                    {
                        "suggestion_code": "IMPROVE_TEACHER_GAPS",
                        "message_key": "quality.suggestions.teacherGaps",
                        "message_params": {"count": 4},
                        "message_farsi": "private prose",
                        "message_english": "private prose",
                        "affected_entities": [],
                        "expected_improvement": 10,
                    }
                ],
            },
            "metadata": {},
        }
    )

    suggestion = response["metadata"]["qualityScore"]["suggestions"][0]
    assert suggestion == {
        "suggestion_code": "IMPROVE_TEACHER_GAPS",
        "message_key": "quality.suggestions.teacherGaps",
        "message_params": {"count": 4},
        "affected_entities": [],
        "expected_improvement": 10,
    }
    assert "private prose" not in str(response)


def test_pre_solve_suggestions_keep_codes_and_parameters_only():
    response = from_pre_solve_response(
        {
            "can_proceed": True,
            "errors": [],
            "warnings": [],
            "suggestions": [
                {
                    "suggestion_code": "REBALANCE_TEACHER",
                    "message_farsi": "private prose",
                    "message_english": "private prose",
                    "message_params": {"teacherName": "Amina"},
                    "expected_improvement": 4,
                }
            ],
            "analysis_time_ms": 12,
        }
    )

    assert response["data"]["suggestions"] == [
        {
            "code": "REBALANCE_TEACHER",
            "messageParams": {"teacherName": "Amina"},
            "expectedImprovement": 4,
        }
    ]
    assert "private prose" not in str(response)


def test_failed_pre_solve_keeps_analysis_out_of_success_data():
    response = from_pre_solve_response(
        {
            "can_proceed": False,
            "errors": [
                {
                    "error_code": "MISSING_ROOM_TYPE",
                    "severity": "error",
                    "affected_entities": [],
                    "context": {"roomType": "laboratory"},
                }
            ],
            "warnings": [],
            "suggestions": [],
            "analysis_time_ms": 8,
        }
    )

    assert response["outcome"] == "failed"
    assert response["data"] is None
    assert response["metadata"]["analysis"] == {
        "canProceed": False,
        "analysisTimeMs": 8,
        "suggestions": [],
    }
    assert response["issues"][0]["code"] == "MISSING_ROOM_TYPE"


def test_validation_issue_exposes_paths_not_library_messages():
    class FakeValidationError(Exception):
        def errors(self):
            return [
                {
                    "loc": ("classes", 0, "grade"),
                    "type": "value_error",
                    "msg": "sensitive implementation message",
                }
            ]

    issue = validation_issue(FakeValidationError())
    assert issue["fieldIssues"] == [
        {"path": "classes.0.grade", "code": "VALUE_ERROR", "params": {}}
    ]
    assert "sensitive implementation message" not in str(issue)
