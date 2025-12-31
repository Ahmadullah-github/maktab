# ==============================================================================
# Property Tests: Error Catalog
#
# Tests for error code naming conventions and error catalog consistency.
#
# **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
# **Validates: Requirements 7.1**
#
# ==============================================================================

import re
from typing import List

import pytest
from hypothesis import given, strategies as st, settings

from feedback.error_catalog import (
    ErrorCode,
    ErrorSeverity,
    ErrorDefinition,
    ERROR_DEFINITIONS,
)


# ==============================================================================
# Constants
# ==============================================================================

# Pattern: CATEGORY_SPECIFIC_ERROR format (e.g., TEACHER_OVERLOAD, ROOM_CONFLICT)
# Must start with uppercase letters, followed by underscore, then more uppercase letters/underscores
ERROR_CODE_PATTERN = re.compile(r"^[A-Z]+(_[A-Z]+)+$")


# ==============================================================================
# Property Tests
# ==============================================================================

class TestErrorCodeNamingConvention:
    """
    **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
    **Validates: Requirements 7.1**
    
    For any error code defined in the error catalog, the code SHALL match
    the pattern CATEGORY_SPECIFIC_ERROR (e.g., TEACHER_OVERLOAD, ROOM_CONFLICT).
    """

    def test_all_error_codes_follow_naming_convention(self):
        """
        **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
        **Validates: Requirements 7.1**
        
        For any error code in ErrorCode enum, the code value SHALL match
        the pattern ^[A-Z]+(_[A-Z]+)+$ (CATEGORY_SPECIFIC_ERROR format).
        """
        for error_code in ErrorCode:
            code_value = error_code.value
            assert ERROR_CODE_PATTERN.match(code_value), (
                f"Error code '{code_value}' does not follow CATEGORY_SPECIFIC_ERROR "
                f"naming convention (pattern: ^[A-Z]+(_[A-Z]+)+$)"
            )

    def test_error_code_enum_name_matches_value(self):
        """
        **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
        **Validates: Requirements 7.1**
        
        For any error code, the enum member name SHALL equal its string value.
        """
        for error_code in ErrorCode:
            assert error_code.name == error_code.value, (
                f"Error code enum name '{error_code.name}' does not match "
                f"its value '{error_code.value}'"
            )

    def test_error_definitions_have_matching_codes(self):
        """
        **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
        **Validates: Requirements 7.1**
        
        For any error definition, the definition's code field SHALL match
        the dictionary key.
        """
        for key, definition in ERROR_DEFINITIONS.items():
            assert key == definition.code, (
                f"Error definition key '{key}' does not match "
                f"definition code '{definition.code}'"
            )

    def test_all_error_codes_have_definitions(self):
        """
        **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
        **Validates: Requirements 7.1**
        
        For any error code in the ErrorCode enum, there SHALL exist
        a corresponding entry in ERROR_DEFINITIONS.
        """
        for error_code in ErrorCode:
            assert error_code in ERROR_DEFINITIONS, (
                f"Error code '{error_code.value}' is missing from ERROR_DEFINITIONS"
            )

    @given(st.sampled_from(list(ErrorCode)))
    @settings(max_examples=100)
    def test_error_code_naming_property(self, error_code: ErrorCode):
        """
        **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
        **Validates: Requirements 7.1**
        
        For any randomly selected error code from the ErrorCode enum,
        the code SHALL match the CATEGORY_SPECIFIC_ERROR pattern.
        """
        code_value = error_code.value
        
        # Must match pattern: CATEGORY_SPECIFIC_ERROR
        assert ERROR_CODE_PATTERN.match(code_value), (
            f"Error code '{code_value}' does not follow naming convention"
        )
        
        # Must contain at least one underscore (separating category from specific)
        assert "_" in code_value, (
            f"Error code '{code_value}' must contain underscore separator"
        )
        
        # Must be all uppercase
        assert code_value == code_value.upper(), (
            f"Error code '{code_value}' must be all uppercase"
        )
        
        # Must not start or end with underscore
        assert not code_value.startswith("_"), (
            f"Error code '{code_value}' must not start with underscore"
        )
        assert not code_value.endswith("_"), (
            f"Error code '{code_value}' must not end with underscore"
        )
        
        # Must not have consecutive underscores
        assert "__" not in code_value, (
            f"Error code '{code_value}' must not have consecutive underscores"
        )

    @given(st.sampled_from(list(ErrorCode)))
    @settings(max_examples=100)
    def test_error_definition_completeness(self, error_code: ErrorCode):
        """
        **Feature: solver-ux-feedback, Property 13: Error Code Naming Convention**
        **Validates: Requirements 7.1**
        
        For any error code, its definition SHALL have all required fields populated.
        """
        definition = ERROR_DEFINITIONS[error_code]
        
        # Code must match
        assert definition.code == error_code
        
        # Severity must be valid
        assert definition.severity in ErrorSeverity
        
        # Message key must be non-empty
        assert definition.message_key, (
            f"Error code '{error_code.value}' has empty message_key"
        )
        
        # Farsi template must be non-empty
        assert definition.message_farsi_template, (
            f"Error code '{error_code.value}' has empty message_farsi_template"
        )
        
        # English template must be non-empty
        assert definition.message_english_template, (
            f"Error code '{error_code.value}' has empty message_english_template"
        )
        
        # required_context_keys must be a list (can be empty)
        assert isinstance(definition.required_context_keys, list), (
            f"Error code '{error_code.value}' has invalid required_context_keys type"
        )

