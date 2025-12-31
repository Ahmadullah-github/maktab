# ==============================================================================
# Property Tests: Error Builder
#
# Tests for error building functionality and message formatting.
#
# **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
# **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
#
# **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
# **Validates: Requirements 7.5**
#
# ==============================================================================

import re
from typing import Any, Dict

import pytest
from hypothesis import given, strategies as st, settings, assume

from feedback.error_catalog import (
    ErrorCode,
    ErrorSeverity,
    ERROR_DEFINITIONS,
)
from feedback.error_builder import (
    build_error,
    build_internal_error,
    _extract_affected_entities,
    _validate_context,
)
from feedback.response_models import SolverErrorDetail, AffectedEntity


# ==============================================================================
# Strategies for generating test data
# ==============================================================================

# Strategy for generating valid teacher names (Farsi-like strings)
farsi_names = st.text(
    alphabet=st.sampled_from("ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی "),
    min_size=2,
    max_size=30
).filter(lambda x: x.strip())

# Strategy for generating entity IDs
entity_ids = st.text(
    alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz0123456789-_"),
    min_size=1,
    max_size=20
).filter(lambda x: x.strip())

# Strategy for generating positive integers for periods/hours
positive_ints = st.integers(min_value=1, max_value=100)

# Strategy for generating day names
day_names = st.sampled_from(["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه"])

# Strategy for generating period numbers
period_numbers = st.integers(min_value=1, max_value=10)


def generate_context_for_error(error_code: ErrorCode) -> st.SearchStrategy[Dict[str, Any]]:
    """Generate a valid context dictionary for a given error code."""
    definition = ERROR_DEFINITIONS[error_code]
    required_keys = definition.required_context_keys
    
    # Build context based on required keys
    context_strategies = {}
    
    for key in required_keys:
        if "Name" in key:
            context_strategies[key] = farsi_names
        elif "Id" in key:
            context_strategies[key] = entity_ids
        elif key in ["availablePeriods", "requiredPeriods", "requiredHours", "availableHours"]:
            context_strategies[key] = positive_ints
        elif key == "dayName":
            context_strategies[key] = day_names
        elif key == "periodNumber":
            context_strategies[key] = period_numbers
        elif key == "timeoutSeconds":
            context_strategies[key] = st.integers(min_value=1, max_value=3600)
        else:
            # Default to simple strings
            context_strategies[key] = st.text(min_size=1, max_size=20).filter(lambda x: x.strip())
    
    if not context_strategies:
        return st.just({})
    
    return st.fixed_dictionaries(context_strategies)



# ==============================================================================
# Property Tests: Error Code Correctness (Property 5)
# ==============================================================================

class TestErrorCodeCorrectness:
    """
    **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
    **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
    
    For any detectable error condition (teacher overload, room conflict, class period
    shortage, no qualified teacher, teacher availability conflict, no feasible solution),
    the solver SHALL return the corresponding error code with a properly formatted
    Farsi message containing all context variables.
    """

    @given(
        teacher_name=farsi_names,
        teacher_id=entity_ids,
        available_periods=positive_ints,
        required_periods=positive_ints,
    )
    @settings(max_examples=100)
    def test_teacher_overload_error_formatting(
        self,
        teacher_name: str,
        teacher_id: str,
        available_periods: int,
        required_periods: int,
    ):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.1**
        
        For any teacher overload condition, build_error SHALL return error code
        TEACHER_OVERLOAD with Farsi message containing teacherName, availablePeriods,
        and requiredPeriods.
        """
        context = {
            "teacherName": teacher_name,
            "teacherId": teacher_id,
            "availablePeriods": available_periods,
            "requiredPeriods": required_periods,
        }
        
        error = build_error(ErrorCode.TEACHER_OVERLOAD, context)
        
        # Verify error code
        assert error.error_code == "TEACHER_OVERLOAD"
        assert error.severity == "error"
        
        # Verify Farsi message contains all context values
        assert teacher_name in error.message_farsi
        assert str(available_periods) in error.message_farsi
        assert str(required_periods) in error.message_farsi
        
        # Verify affected entities extracted
        teacher_entities = [e for e in error.affected_entities if e.entity_type == "teacher"]
        assert len(teacher_entities) == 1
        assert teacher_entities[0].entity_id == teacher_id
        assert teacher_entities[0].entity_name == teacher_name

    @given(
        room_name=farsi_names,
        room_id=entity_ids,
        day_name=day_names,
        period_number=period_numbers,
        class1_name=farsi_names,
        class1_id=entity_ids,
        class2_name=farsi_names,
        class2_id=entity_ids,
    )
    @settings(max_examples=100)
    def test_room_conflict_error_formatting(
        self,
        room_name: str,
        room_id: str,
        day_name: str,
        period_number: int,
        class1_name: str,
        class1_id: str,
        class2_name: str,
        class2_id: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.2**
        
        For any room conflict condition, build_error SHALL return error code
        ROOM_CONFLICT with Farsi message containing roomName, dayName, periodNumber,
        class1Name, and class2Name.
        """
        context = {
            "roomName": room_name,
            "roomId": room_id,
            "dayName": day_name,
            "periodNumber": period_number,
            "class1Name": class1_name,
            "class1Id": class1_id,
            "class2Name": class2_name,
            "class2Id": class2_id,
        }
        
        error = build_error(ErrorCode.ROOM_CONFLICT, context)
        
        # Verify error code
        assert error.error_code == "ROOM_CONFLICT"
        assert error.severity == "error"
        
        # Verify Farsi message contains all context values
        assert room_name in error.message_farsi
        assert day_name in error.message_farsi
        assert str(period_number) in error.message_farsi
        assert class1_name in error.message_farsi
        assert class2_name in error.message_farsi
        
        # Verify affected entities extracted (room + 2 classes)
        room_entities = [e for e in error.affected_entities if e.entity_type == "room"]
        class_entities = [e for e in error.affected_entities if e.entity_type == "class"]
        assert len(room_entities) == 1
        assert len(class_entities) == 2

    @given(
        class_name=farsi_names,
        class_id=entity_ids,
        required_hours=positive_ints,
        available_hours=positive_ints,
    )
    @settings(max_examples=100)
    def test_class_period_shortage_error_formatting(
        self,
        class_name: str,
        class_id: str,
        required_hours: int,
        available_hours: int,
    ):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.3**
        
        For any class period shortage condition, build_error SHALL return error code
        CLASS_PERIOD_SHORTAGE with Farsi message containing className, requiredHours,
        and availableHours.
        """
        context = {
            "className": class_name,
            "classId": class_id,
            "requiredHours": required_hours,
            "availableHours": available_hours,
        }
        
        error = build_error(ErrorCode.CLASS_PERIOD_SHORTAGE, context)
        
        # Verify error code
        assert error.error_code == "CLASS_PERIOD_SHORTAGE"
        assert error.severity == "error"
        
        # Verify Farsi message contains all context values
        assert class_name in error.message_farsi
        assert str(required_hours) in error.message_farsi
        assert str(available_hours) in error.message_farsi
        
        # Verify affected entities extracted
        class_entities = [e for e in error.affected_entities if e.entity_type == "class"]
        assert len(class_entities) == 1
        assert class_entities[0].entity_id == class_id

    @given(
        subject_name=farsi_names,
        subject_id=entity_ids,
        class_name=farsi_names,
        class_id=entity_ids,
    )
    @settings(max_examples=100)
    def test_no_qualified_teacher_error_formatting(
        self,
        subject_name: str,
        subject_id: str,
        class_name: str,
        class_id: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.4**
        
        For any no qualified teacher condition, build_error SHALL return error code
        NO_QUALIFIED_TEACHER with Farsi message containing subjectName and className.
        """
        context = {
            "subjectName": subject_name,
            "subjectId": subject_id,
            "className": class_name,
            "classId": class_id,
        }
        
        error = build_error(ErrorCode.NO_QUALIFIED_TEACHER, context)
        
        # Verify error code
        assert error.error_code == "NO_QUALIFIED_TEACHER"
        assert error.severity == "error"
        
        # Verify Farsi message contains all context values
        assert subject_name in error.message_farsi
        assert class_name in error.message_farsi
        
        # Verify affected entities extracted
        subject_entities = [e for e in error.affected_entities if e.entity_type == "subject"]
        class_entities = [e for e in error.affected_entities if e.entity_type == "class"]
        assert len(subject_entities) == 1
        assert len(class_entities) == 1

    @given(
        teacher_name=farsi_names,
        teacher_id=entity_ids,
        subject_name=farsi_names,
        subject_id=entity_ids,
    )
    @settings(max_examples=100)
    def test_teacher_availability_conflict_error_formatting(
        self,
        teacher_name: str,
        teacher_id: str,
        subject_name: str,
        subject_id: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.5**
        
        For any teacher availability conflict condition, build_error SHALL return
        error code TEACHER_AVAILABILITY_CONFLICT with Farsi message containing
        teacherName and subjectName.
        """
        context = {
            "teacherName": teacher_name,
            "teacherId": teacher_id,
            "subjectName": subject_name,
            "subjectId": subject_id,
        }
        
        error = build_error(ErrorCode.TEACHER_AVAILABILITY_CONFLICT, context)
        
        # Verify error code
        assert error.error_code == "TEACHER_AVAILABILITY_CONFLICT"
        assert error.severity == "error"
        
        # Verify Farsi message contains all context values
        assert teacher_name in error.message_farsi
        assert subject_name in error.message_farsi
        
        # Verify affected entities extracted
        teacher_entities = [e for e in error.affected_entities if e.entity_type == "teacher"]
        subject_entities = [e for e in error.affected_entities if e.entity_type == "subject"]
        assert len(teacher_entities) == 1
        assert len(subject_entities) == 1

    def test_no_feasible_solution_error_formatting(self):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.6**
        
        For any no feasible solution condition, build_error SHALL return error code
        NO_FEASIBLE_SOLUTION with the standard Farsi message.
        """
        # NO_FEASIBLE_SOLUTION has no required context keys
        error = build_error(ErrorCode.NO_FEASIBLE_SOLUTION, {})
        
        # Verify error code
        assert error.error_code == "NO_FEASIBLE_SOLUTION"
        assert error.severity == "error"
        
        # Verify Farsi message is the expected template
        expected_farsi = (
            "با محدودیت‌های فعلی امکان ایجاد جدول زمانی وجود ندارد. "
            "لطفاً محدودیت‌ها را بررسی کنید"
        )
        assert error.message_farsi == expected_farsi
        
        # No affected entities for this error type
        assert len(error.affected_entities) == 0

    @given(st.sampled_from([
        ErrorCode.TEACHER_OVERLOAD,
        ErrorCode.ROOM_CONFLICT,
        ErrorCode.CLASS_PERIOD_SHORTAGE,
        ErrorCode.NO_QUALIFIED_TEACHER,
        ErrorCode.TEACHER_AVAILABILITY_CONFLICT,
    ]))
    @settings(max_examples=100)
    def test_missing_context_raises_error(self, error_code: ErrorCode):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
        
        For any error code with required context keys, build_error SHALL raise
        ValueError when context is missing required keys.
        """
        definition = ERROR_DEFINITIONS[error_code]
        
        # Skip if no required keys
        if not definition.required_context_keys:
            return
        
        # Empty context should fail
        with pytest.raises(ValueError) as exc_info:
            build_error(error_code, {})
        
        assert "Missing required context keys" in str(exc_info.value)

    @given(st.sampled_from(list(ErrorCode)))
    @settings(max_examples=100)
    def test_error_structure_completeness(self, error_code: ErrorCode):
        """
        **Feature: solver-ux-feedback, Property 5: Error Code Correctness**
        **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
        
        For any error code, build_error SHALL return a SolverErrorDetail with
        all required fields populated.
        """
        definition = ERROR_DEFINITIONS[error_code]
        
        # Build minimal valid context
        context = {}
        for key in definition.required_context_keys:
            if "Name" in key:
                context[key] = "تست"
            elif "Id" in key:
                context[key] = "test-id"
            elif key in ["availablePeriods", "requiredPeriods", "requiredHours", 
                        "availableHours", "periodNumber", "timeoutSeconds"]:
                context[key] = 10
            elif key == "dayName":
                context[key] = "شنبه"
            else:
                context[key] = "test"
        
        error = build_error(error_code, context)
        
        # Verify all required fields are present and non-empty
        assert error.error_code == error_code.value
        assert error.severity in ["error", "warning", "info"]
        assert error.message_key
        assert error.message_farsi
        assert error.message_english
        assert isinstance(error.affected_entities, list)
        assert isinstance(error.context, dict)
        
        # Context should contain all provided values
        for key, value in context.items():
            assert key in error.context
            assert error.context[key] == value



# ==============================================================================
# Property Tests: Unknown Error Fallback (Property 14)
# ==============================================================================

# Strategy for generating exception messages
exception_messages = st.text(min_size=0, max_size=200)

# Strategy for generating exception types
exception_types = st.sampled_from([
    ValueError,
    TypeError,
    RuntimeError,
    KeyError,
    AttributeError,
    IndexError,
    ZeroDivisionError,
    Exception,
])


class TestUnknownErrorFallback:
    """
    **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
    **Validates: Requirements 7.5**
    
    For any unexpected exception during solver execution, the solver SHALL return
    error code INTERNAL_ERROR with a generic Farsi message and include technical
    details in a debug field.
    """

    @given(
        exception_type=exception_types,
        message=exception_messages,
    )
    @settings(max_examples=100)
    def test_internal_error_returns_correct_code(
        self,
        exception_type: type,
        message: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
        **Validates: Requirements 7.5**
        
        For any exception, build_internal_error SHALL return error code INTERNAL_ERROR.
        """
        exception = exception_type(message)
        error = build_internal_error(exception)
        
        assert error.error_code == "INTERNAL_ERROR"

    @given(
        exception_type=exception_types,
        message=exception_messages,
    )
    @settings(max_examples=100)
    def test_internal_error_has_generic_farsi_message(
        self,
        exception_type: type,
        message: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
        **Validates: Requirements 7.5**
        
        For any exception, build_internal_error SHALL return the generic Farsi message
        "خطای داخلی رخ داد. لطفاً دوباره تلاش کنید".
        """
        exception = exception_type(message)
        error = build_internal_error(exception)
        
        expected_farsi = "خطای داخلی رخ داد. لطفاً دوباره تلاش کنید"
        assert error.message_farsi == expected_farsi

    @given(
        exception_type=exception_types,
        message=exception_messages,
    )
    @settings(max_examples=100)
    def test_internal_error_includes_debug_field(
        self,
        exception_type: type,
        message: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
        **Validates: Requirements 7.5**
        
        For any exception, build_internal_error SHALL include technical details
        in a debug field within the context.
        """
        exception = exception_type(message)
        error = build_internal_error(exception)
        
        # Debug field must exist in context
        assert "debug" in error.context
        
        debug = error.context["debug"]
        
        # Debug must contain exception type
        assert "exception_type" in debug
        assert debug["exception_type"] == exception_type.__name__
        
        # Debug must contain exception message
        # Note: str(exception) is used, which may differ from the raw message
        # for some exception types (e.g., KeyError wraps the key in quotes)
        assert "exception_message" in debug
        assert debug["exception_message"] == str(exception)

    @given(
        exception_type=exception_types,
        message=exception_messages,
    )
    @settings(max_examples=100)
    def test_internal_error_structure_completeness(
        self,
        exception_type: type,
        message: str,
    ):
        """
        **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
        **Validates: Requirements 7.5**
        
        For any exception, build_internal_error SHALL return a complete
        SolverErrorDetail with all required fields.
        """
        exception = exception_type(message)
        error = build_internal_error(exception)
        
        # Verify all required fields are present
        assert error.error_code == "INTERNAL_ERROR"
        assert error.severity == "error"
        assert error.message_key == "error.solver.internal"
        assert error.message_farsi
        assert error.message_english
        assert isinstance(error.affected_entities, list)
        assert len(error.affected_entities) == 0  # No affected entities for internal errors
        assert isinstance(error.context, dict)
        assert "debug" in error.context

    def test_internal_error_with_nested_exception(self):
        """
        **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
        **Validates: Requirements 7.5**
        
        For exceptions with nested causes, build_internal_error SHALL still
        return a valid error with debug information.
        """
        try:
            try:
                raise ValueError("inner error")
            except ValueError:
                raise RuntimeError("outer error") from ValueError("inner error")
        except RuntimeError as e:
            error = build_internal_error(e)
        
        assert error.error_code == "INTERNAL_ERROR"
        assert error.context["debug"]["exception_type"] == "RuntimeError"
        assert "outer error" in error.context["debug"]["exception_message"]

    def test_internal_error_with_empty_message(self):
        """
        **Feature: solver-ux-feedback, Property 14: Unknown Error Fallback**
        **Validates: Requirements 7.5**
        
        For exceptions with empty messages, build_internal_error SHALL still
        return a valid error.
        """
        error = build_internal_error(Exception())
        
        assert error.error_code == "INTERNAL_ERROR"
        assert error.context["debug"]["exception_type"] == "Exception"
        assert error.context["debug"]["exception_message"] == ""
