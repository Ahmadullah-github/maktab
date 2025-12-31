# ==============================================================================
# Property Tests: Response Models
#
# Tests for response schema conformance and error object completeness.
#
# **Feature: solver-ux-feedback, Property 1: Response Schema Conformance**
# **Validates: Requirements 1.1**
#
# **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
# **Validates: Requirements 1.2, 1.3**
#
# ==============================================================================

from typing import Any, Dict, List, Optional

import pytest
from hypothesis import given, strategies as st, settings, assume
from pydantic import ValidationError

from feedback.response_models import (
    ResponseStatus,
    AffectedEntity,
    SolverErrorDetail,
    QualityBreakdown,
    Suggestion,
    QualityScore,
    SolverResponseMetadata,
    SolverResponse,
)
from feedback.error_catalog import (
    ErrorCode,
    ErrorSeverity,
    ERROR_DEFINITIONS,
)


# ==============================================================================
# Strategies for generating test data
# ==============================================================================

# Strategy for entity types
entity_type_strategy = st.sampled_from(["teacher", "class", "room", "subject"])

# Strategy for generating valid AffectedEntity
affected_entity_strategy = st.builds(
    AffectedEntity,
    entity_type=entity_type_strategy,
    entity_id=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
    entity_name=st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
)

# Strategy for severity levels
severity_strategy = st.sampled_from(["error", "warning", "info"])

# Strategy for generating valid SolverErrorDetail
solver_error_detail_strategy = st.builds(
    SolverErrorDetail,
    error_code=st.sampled_from([e.value for e in ErrorCode]),
    severity=severity_strategy,
    message_key=st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
    message_farsi=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
    message_english=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
    affected_entities=st.lists(affected_entity_strategy, min_size=0, max_size=5),
    context=st.dictionaries(
        keys=st.text(min_size=1, max_size=30).filter(lambda x: x.strip() and x.isidentifier()),
        values=st.one_of(st.text(max_size=100), st.integers(), st.floats(allow_nan=False)),
        min_size=0,
        max_size=10,
    ),
)


# Strategy for generating valid Suggestion
suggestion_strategy = st.builds(
    Suggestion,
    suggestion_code=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
    message_farsi=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
    affected_entities=st.lists(affected_entity_strategy, min_size=0, max_size=3),
    expected_improvement=st.integers(min_value=0, max_value=100),
)

# Strategy for generating valid QualityBreakdown
quality_breakdown_strategy = st.builds(
    QualityBreakdown,
    teacher_gaps=st.fixed_dictionaries({
        "count": st.integers(min_value=0, max_value=100),
        "penalty": st.integers(min_value=0, max_value=100),
        "details": st.just([]),
    }),
    afternoon_difficult_subjects=st.fixed_dictionaries({
        "count": st.integers(min_value=0, max_value=100),
        "penalty": st.integers(min_value=0, max_value=100),
        "details": st.just([]),
    }),
    same_day_subject_repetition=st.fixed_dictionaries({
        "count": st.integers(min_value=0, max_value=100),
        "penalty": st.integers(min_value=0, max_value=100),
        "details": st.just([]),
    }),
    teacher_load_balance=st.fixed_dictionaries({
        "variance": st.floats(min_value=0.0, max_value=10.0, allow_nan=False),
        "penalty": st.integers(min_value=0, max_value=100),
    }),
)

# Strategy for generating valid QualityScore
quality_score_strategy = st.builds(
    QualityScore,
    overall=st.integers(min_value=0, max_value=100),
    breakdown=quality_breakdown_strategy,
    suggestions=st.lists(suggestion_strategy, min_size=0, max_size=5),
)

# Strategy for generating valid SolverResponseMetadata
metadata_strategy = st.builds(
    SolverResponseMetadata,
    solve_time_seconds=st.one_of(st.none(), st.floats(min_value=0.0, max_value=3600.0, allow_nan=False)),
    strategy_selected=st.one_of(st.none(), st.sampled_from(["fast", "balanced", "thorough"])),
    strategy_reason=st.one_of(st.none(), st.text(min_size=1, max_size=200).filter(lambda x: x.strip())),
    strategy_overridden=st.one_of(st.none(), st.booleans()),
    total_lessons=st.one_of(st.none(), st.integers(min_value=0, max_value=10000)),
)

# Strategy for generating timetable data (simplified)
timetable_data_strategy = st.one_of(
    st.none(),
    st.fixed_dictionaries({
        "schedule": st.lists(
            st.fixed_dictionaries({
                "day": st.integers(min_value=0, max_value=6),
                "period": st.integers(min_value=0, max_value=10),
                "classId": st.text(min_size=1, max_size=20),
            }),
            min_size=0,
            max_size=5,
        ),
    }),
)


# ==============================================================================
# Property Tests: Response Schema Conformance (Property 1)
# ==============================================================================

class TestResponseSchemaConformance:
    """
    **Feature: solver-ux-feedback, Property 1: Response Schema Conformance**
    **Validates: Requirements 1.1**
    
    For any solver execution (success, failure, or partial), the returned response
    SHALL conform to the SolverResponse schema with all required fields present.
    """

    @given(
        status=st.sampled_from(list(ResponseStatus)),
        errors=st.lists(solver_error_detail_strategy, min_size=0, max_size=5),
        warnings=st.lists(solver_error_detail_strategy, min_size=0, max_size=5),
        quality_score=st.one_of(st.none(), quality_score_strategy),
        metadata=metadata_strategy,
    )
    @settings(max_examples=100)
    def test_solver_response_has_all_required_fields(
        self,
        status: ResponseStatus,
        errors: List[SolverErrorDetail],
        warnings: List[SolverErrorDetail],
        quality_score: Optional[QualityScore],
        metadata: SolverResponseMetadata,
    ):
        """
        **Feature: solver-ux-feedback, Property 1: Response Schema Conformance**
        **Validates: Requirements 1.1**
        
        For any combination of valid inputs, SolverResponse SHALL be constructable
        with all required fields (status, data, errors, warnings, metadata).
        """
        # Determine data based on status
        data = {"schedule": []} if status == ResponseStatus.SUCCESS else None
        
        response = SolverResponse(
            status=status,
            data=data,
            errors=errors,
            warnings=warnings,
            quality_score=quality_score,
            metadata=metadata,
        )
        
        # Verify all required fields are present
        assert response.status is not None, "status field must be present"
        assert hasattr(response, "data"), "data field must be present"
        assert hasattr(response, "errors"), "errors field must be present"
        assert hasattr(response, "warnings"), "warnings field must be present"
        assert hasattr(response, "metadata"), "metadata field must be present"
        
        # Verify status is valid enum value
        assert response.status in ResponseStatus, "status must be valid ResponseStatus"
        
        # Verify errors and warnings are lists
        assert isinstance(response.errors, list), "errors must be a list"
        assert isinstance(response.warnings, list), "warnings must be a list"


    @given(st.sampled_from(list(ResponseStatus)))
    @settings(max_examples=100)
    def test_response_serializes_to_valid_json(self, status: ResponseStatus):
        """
        **Feature: solver-ux-feedback, Property 1: Response Schema Conformance**
        **Validates: Requirements 1.1**
        
        For any valid SolverResponse, serialization to JSON SHALL succeed
        and produce a valid JSON object with all required fields.
        """
        response = SolverResponse(
            status=status,
            data={"schedule": []} if status == ResponseStatus.SUCCESS else None,
            errors=[],
            warnings=[],
            quality_score=None,
            metadata=SolverResponseMetadata(),
        )
        
        # Serialize to dict (JSON-compatible)
        json_dict = response.model_dump()
        
        # Verify required fields in JSON
        assert "status" in json_dict, "JSON must contain status"
        assert "data" in json_dict, "JSON must contain data"
        assert "errors" in json_dict, "JSON must contain errors"
        assert "warnings" in json_dict, "JSON must contain warnings"
        assert "metadata" in json_dict, "JSON must contain metadata"

    @given(
        status=st.sampled_from(list(ResponseStatus)),
        data=timetable_data_strategy,
    )
    @settings(max_examples=100)
    def test_response_with_various_data_types(
        self,
        status: ResponseStatus,
        data: Optional[Dict[str, Any]],
    ):
        """
        **Feature: solver-ux-feedback, Property 1: Response Schema Conformance**
        **Validates: Requirements 1.1**
        
        For any valid status and data combination, SolverResponse SHALL
        accept the data and maintain schema conformance.
        """
        response = SolverResponse(
            status=status,
            data=data,
            errors=[],
            warnings=[],
            metadata=SolverResponseMetadata(),
        )
        
        # Response should be valid
        assert response.status == status
        assert response.data == data

    def test_all_response_statuses_are_valid(self):
        """
        **Feature: solver-ux-feedback, Property 1: Response Schema Conformance**
        **Validates: Requirements 1.1**
        
        All ResponseStatus enum values SHALL be usable in SolverResponse.
        """
        for status in ResponseStatus:
            response = SolverResponse(
                status=status,
                data=None,
                errors=[],
                warnings=[],
                metadata=SolverResponseMetadata(),
            )
            assert response.status == status


# ==============================================================================
# Property Tests: Error Object Completeness (Property 2)
# ==============================================================================

class TestErrorObjectCompleteness:
    """
    **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
    **Validates: Requirements 1.2, 1.3**
    
    For any error returned by the solver, the error object SHALL contain all
    required fields (errorCode, severity, messageKey, messageFarsi, messageEnglish,
    affectedEntities, context) AND the context SHALL include all variables
    referenced in the message templates.
    """

    @given(solver_error_detail_strategy)
    @settings(max_examples=100)
    def test_error_detail_has_all_required_fields(self, error: SolverErrorDetail):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        For any SolverErrorDetail, all required fields SHALL be present and non-empty.
        """
        # Verify all required fields are present
        assert error.error_code is not None, "error_code must be present"
        assert error.severity is not None, "severity must be present"
        assert error.message_key is not None, "message_key must be present"
        assert error.message_farsi is not None, "message_farsi must be present"
        assert error.message_english is not None, "message_english must be present"
        assert error.affected_entities is not None, "affected_entities must be present"
        assert error.context is not None, "context must be present"
        
        # Verify types
        assert isinstance(error.error_code, str), "error_code must be string"
        assert isinstance(error.severity, str), "severity must be string"
        assert isinstance(error.message_key, str), "message_key must be string"
        assert isinstance(error.message_farsi, str), "message_farsi must be string"
        assert isinstance(error.message_english, str), "message_english must be string"
        assert isinstance(error.affected_entities, list), "affected_entities must be list"
        assert isinstance(error.context, dict), "context must be dict"

    @given(st.sampled_from(list(ErrorCode)))
    @settings(max_examples=100)
    def test_error_definition_context_keys_match_template(self, error_code: ErrorCode):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        For any error code, the required_context_keys SHALL include all
        placeholders used in the message templates.
        """
        definition = ERROR_DEFINITIONS[error_code]
        
        # Extract placeholders from Farsi template
        import re
        farsi_placeholders = set(re.findall(r'\{(\w+)\}', definition.message_farsi_template))
        english_placeholders = set(re.findall(r'\{(\w+)\}', definition.message_english_template))
        
        # All placeholders should be in required_context_keys
        required_keys = set(definition.required_context_keys)
        
        missing_farsi = farsi_placeholders - required_keys
        missing_english = english_placeholders - required_keys
        
        assert not missing_farsi, (
            f"Error code '{error_code.value}' Farsi template uses placeholders "
            f"{missing_farsi} not in required_context_keys"
        )
        assert not missing_english, (
            f"Error code '{error_code.value}' English template uses placeholders "
            f"{missing_english} not in required_context_keys"
        )


    @given(affected_entity_strategy)
    @settings(max_examples=100)
    def test_affected_entity_has_all_required_fields(self, entity: AffectedEntity):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        For any AffectedEntity, all required fields SHALL be present.
        """
        assert entity.entity_type is not None, "entity_type must be present"
        assert entity.entity_id is not None, "entity_id must be present"
        assert entity.entity_name is not None, "entity_name must be present"
        
        # Verify entity_type is valid
        assert entity.entity_type in ["teacher", "class", "room", "subject"], (
            f"entity_type '{entity.entity_type}' is not valid"
        )

    @given(solver_error_detail_strategy)
    @settings(max_examples=100)
    def test_error_detail_serializes_completely(self, error: SolverErrorDetail):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        For any SolverErrorDetail, serialization SHALL include all fields.
        """
        json_dict = error.model_dump()
        
        # All required fields must be in serialized output
        required_fields = [
            "error_code", "severity", "message_key",
            "message_farsi", "message_english",
            "affected_entities", "context"
        ]
        
        for field in required_fields:
            assert field in json_dict, f"Serialized error must contain '{field}'"

    def test_all_error_codes_produce_complete_errors(self):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        For any error code in ERROR_DEFINITIONS, creating an error with
        all required context keys SHALL produce a complete error object.
        """
        for error_code, definition in ERROR_DEFINITIONS.items():
            # Create context with all required keys
            context = {}
            for key in definition.required_context_keys:
                # Provide dummy values based on common key patterns
                if "Id" in key:
                    context[key] = f"test-{key}-123"
                elif "Name" in key:
                    context[key] = f"Test {key}"
                elif "Periods" in key or "Hours" in key or "Number" in key:
                    context[key] = 10
                elif "Seconds" in key:
                    context[key] = 60
                else:
                    context[key] = f"value-{key}"
            
            # Format messages
            try:
                message_farsi = definition.message_farsi_template.format(**context)
                message_english = definition.message_english_template.format(**context)
            except KeyError as e:
                pytest.fail(
                    f"Error code '{error_code.value}' template requires key {e} "
                    f"not in required_context_keys"
                )
            
            # Create error detail
            error = SolverErrorDetail(
                error_code=error_code.value,
                severity=definition.severity.value,
                message_key=definition.message_key,
                message_farsi=message_farsi,
                message_english=message_english,
                affected_entities=[],
                context=context,
            )
            
            # Verify completeness
            assert error.error_code == error_code.value
            assert error.severity == definition.severity.value
            assert error.message_key == definition.message_key
            assert error.message_farsi  # Non-empty
            assert error.message_english  # Non-empty

    @given(st.sampled_from(list(ErrorCode)))
    @settings(max_examples=100)
    def test_error_severity_is_valid(self, error_code: ErrorCode):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        For any error code, its severity SHALL be a valid ErrorSeverity value.
        """
        definition = ERROR_DEFINITIONS[error_code]
        assert definition.severity in ErrorSeverity, (
            f"Error code '{error_code.value}' has invalid severity '{definition.severity}'"
        )

    def test_error_detail_rejects_missing_required_fields(self):
        """
        **Feature: solver-ux-feedback, Property 2: Error Object Completeness**
        **Validates: Requirements 1.2, 1.3**
        
        SolverErrorDetail SHALL reject construction with missing required fields.
        """
        # Missing error_code should raise ValidationError
        with pytest.raises(ValidationError):
            SolverErrorDetail(
                severity="error",
                message_key="test.key",
                message_farsi="Test",
                message_english="Test",
            )
        
        # Missing severity should raise ValidationError
        with pytest.raises(ValidationError):
            SolverErrorDetail(
                error_code="TEST_ERROR",
                message_key="test.key",
                message_farsi="Test",
                message_english="Test",
            )



# ==============================================================================
# Property Tests: Error Severity Determines Status (Property 4)
# ==============================================================================

class TestErrorSeverityDeterminesStatus:
    """
    **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
    **Validates: Requirements 1.5**
    
    For any solver response, if the errors array contains at least one error
    with severity "error", then status SHALL be "failed" AND data SHALL be null/empty.
    """

    @given(
        errors=st.lists(solver_error_detail_strategy, min_size=1, max_size=5),
        warnings=st.lists(solver_error_detail_strategy, min_size=0, max_size=3),
    )
    @settings(max_examples=100)
    def test_errors_with_severity_error_require_failed_status(
        self,
        errors: List[SolverErrorDetail],
        warnings: List[SolverErrorDetail],
    ):
        """
        **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
        **Validates: Requirements 1.5**
        
        For any response with at least one error having severity "error",
        the response status SHALL be "failed" and data SHALL be None.
        """
        # Check if any error has severity "error"
        has_error_severity = any(e.severity == "error" for e in errors)
        
        if has_error_severity:
            # When there's an error with severity "error", status must be "failed"
            # and data must be None
            response = SolverResponse(
                status=ResponseStatus.FAILED,
                data=None,
                errors=errors,
                warnings=warnings,
                metadata=SolverResponseMetadata(),
            )
            
            assert response.status == ResponseStatus.FAILED, (
                "Status must be 'failed' when errors contain severity 'error'"
            )
            assert response.data is None, (
                "Data must be None when errors contain severity 'error'"
            )

    @given(
        warnings=st.lists(solver_error_detail_strategy, min_size=0, max_size=5),
        quality_score=st.one_of(st.none(), quality_score_strategy),
    )
    @settings(max_examples=100)
    def test_no_errors_allows_success_status(
        self,
        warnings: List[SolverErrorDetail],
        quality_score: Optional[QualityScore],
    ):
        """
        **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
        **Validates: Requirements 1.5**
        
        For any response with no errors (empty errors array), the status
        MAY be "success" and data MAY contain timetable data.
        """
        # With no errors, success status is allowed
        response = SolverResponse(
            status=ResponseStatus.SUCCESS,
            data={"schedule": [], "metadata": {}, "statistics": {}},
            errors=[],
            warnings=warnings,
            quality_score=quality_score,
            metadata=SolverResponseMetadata(),
        )
        
        assert response.status == ResponseStatus.SUCCESS
        assert response.data is not None

    @given(
        warnings_only=st.lists(
            st.builds(
                SolverErrorDetail,
                error_code=st.sampled_from([e.value for e in ErrorCode]),
                severity=st.just("warning"),  # Only warnings, no errors
                message_key=st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
                message_farsi=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
                message_english=st.text(min_size=1, max_size=500).filter(lambda x: x.strip()),
                affected_entities=st.lists(affected_entity_strategy, min_size=0, max_size=3),
                context=st.just({}),
            ),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_warnings_only_allows_partial_or_success_status(
        self,
        warnings_only: List[SolverErrorDetail],
    ):
        """
        **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
        **Validates: Requirements 1.5**
        
        For any response with only warnings (no errors with severity "error"),
        the status MAY be "partial" or "success" and data MAY be present.
        """
        # Verify all items are warnings
        assert all(w.severity == "warning" for w in warnings_only)
        
        # With only warnings, partial status is allowed with data
        response = SolverResponse(
            status=ResponseStatus.PARTIAL,
            data={"schedule": [], "metadata": {}, "statistics": {}},
            errors=[],
            warnings=warnings_only,
            metadata=SolverResponseMetadata(),
        )
        
        assert response.status == ResponseStatus.PARTIAL
        assert response.data is not None

    def test_failed_status_requires_no_data(self):
        """
        **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
        **Validates: Requirements 1.5**
        
        When status is "failed", data SHALL be None or empty.
        """
        error = SolverErrorDetail(
            error_code=ErrorCode.NO_FEASIBLE_SOLUTION.value,
            severity="error",
            message_key="error.solver.no_feasible_solution",
            message_farsi="خطا",
            message_english="Error",
            affected_entities=[],
            context={},
        )
        
        response = SolverResponse(
            status=ResponseStatus.FAILED,
            data=None,
            errors=[error],
            warnings=[],
            metadata=SolverResponseMetadata(),
        )
        
        assert response.status == ResponseStatus.FAILED
        assert response.data is None
        assert len(response.errors) > 0
        assert any(e.severity == "error" for e in response.errors)

    @given(
        num_errors=st.integers(min_value=1, max_value=5),
        num_warnings=st.integers(min_value=0, max_value=5),
    )
    @settings(max_examples=100)
    def test_mixed_severity_with_at_least_one_error_requires_failed(
        self,
        num_errors: int,
        num_warnings: int,
    ):
        """
        **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
        **Validates: Requirements 1.5**
        
        For any response with mixed severities where at least one has
        severity "error", the status SHALL be "failed".
        """
        # Create errors with severity "error"
        errors = [
            SolverErrorDetail(
                error_code=ErrorCode.INTERNAL_ERROR.value,
                severity="error",
                message_key=f"error.test.{i}",
                message_farsi=f"خطای {i}",
                message_english=f"Error {i}",
                affected_entities=[],
                context={},
            )
            for i in range(num_errors)
        ]
        
        # Create warnings
        warnings = [
            SolverErrorDetail(
                error_code=ErrorCode.ROOM_CAPACITY_WARNING.value,
                severity="warning",
                message_key=f"warning.test.{i}",
                message_farsi=f"هشدار {i}",
                message_english=f"Warning {i}",
                affected_entities=[],
                context={},
            )
            for i in range(num_warnings)
        ]
        
        # With at least one error, status must be failed
        response = SolverResponse(
            status=ResponseStatus.FAILED,
            data=None,
            errors=errors,
            warnings=warnings,
            metadata=SolverResponseMetadata(),
        )
        
        assert response.status == ResponseStatus.FAILED
        assert response.data is None
        assert len(response.errors) >= 1
        assert any(e.severity == "error" for e in response.errors)

    def test_all_error_codes_with_error_severity_produce_failed_status(self):
        """
        **Feature: solver-ux-feedback, Property 4: Error Severity Determines Status**
        **Validates: Requirements 1.5**
        
        For any error code with severity "error" in ERROR_DEFINITIONS,
        using it in a response SHALL require status "failed".
        """
        for error_code, definition in ERROR_DEFINITIONS.items():
            if definition.severity == ErrorSeverity.ERROR:
                # Create context with required keys
                context = {}
                for key in definition.required_context_keys:
                    if "Id" in key:
                        context[key] = f"test-{key}-123"
                    elif "Name" in key:
                        context[key] = f"Test {key}"
                    elif "Periods" in key or "Hours" in key or "Number" in key:
                        context[key] = 10
                    elif "Seconds" in key:
                        context[key] = 60
                    else:
                        context[key] = f"value-{key}"
                
                error = SolverErrorDetail(
                    error_code=error_code.value,
                    severity=definition.severity.value,
                    message_key=definition.message_key,
                    message_farsi=definition.message_farsi_template.format(**context) if context else definition.message_farsi_template,
                    message_english=definition.message_english_template.format(**context) if context else definition.message_english_template,
                    affected_entities=[],
                    context=context,
                )
                
                response = SolverResponse(
                    status=ResponseStatus.FAILED,
                    data=None,
                    errors=[error],
                    warnings=[],
                    metadata=SolverResponseMetadata(),
                )
                
                assert response.status == ResponseStatus.FAILED, (
                    f"Error code '{error_code.value}' with severity 'error' "
                    f"should require status 'failed'"
                )
                assert response.data is None, (
                    f"Error code '{error_code.value}' with severity 'error' "
                    f"should have data=None"
                )
