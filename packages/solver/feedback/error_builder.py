# ==============================================================================
#
#  Error Builder for Timetable Solver
#
#  Description:
#  Utility functions for building standardized error objects from error codes
#  and context data. Handles message formatting and entity extraction.
#
#  Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.5
#
# ==============================================================================

from typing import Any, Dict, List

from feedback.error_catalog import (
    ErrorCode,
    ErrorSeverity,
    ERROR_DEFINITIONS,
)
from feedback.response_models import AffectedEntity, SolverErrorDetail


# Entity ID field suffixes that indicate an entity reference in context
ENTITY_ID_SUFFIXES = ["Id", "_id"]

# Mapping from context key patterns to entity types
ENTITY_TYPE_MAPPING = {
    "teacher": "teacher",
    "class": "class",
    "room": "room",
    "subject": "subject",
}


def _extract_affected_entities(context: Dict[str, Any]) -> List[AffectedEntity]:
    """Extract affected entities from context based on ID fields.
    
    Looks for patterns like:
    - teacherId/teacherName -> teacher entity
    - classId/className -> class entity
    - roomId/roomName -> room entity
    - subjectId/subjectName -> subject entity
    
    Also handles numbered entities like class1Id/class1Name, class2Id/class2Name.
    
    Args:
        context: Error context dictionary
        
    Returns:
        List of AffectedEntity objects extracted from context
    """
    entities: List[AffectedEntity] = []
    processed_keys: set = set()
    
    for key, value in context.items():
        if key in processed_keys:
            continue
            
        # Check if this is an ID field
        is_id_field = any(key.endswith(suffix) for suffix in ENTITY_ID_SUFFIXES)
        if not is_id_field:
            continue
        
        # Determine entity type from key prefix
        entity_type = None
        base_key = None
        
        for type_prefix, etype in ENTITY_TYPE_MAPPING.items():
            # Handle both "teacherId" and "teacher1Id" patterns
            if key.lower().startswith(type_prefix):
                entity_type = etype
                # Extract the base (e.g., "teacher", "teacher1", "class1")
                for suffix in ENTITY_ID_SUFFIXES:
                    if key.endswith(suffix):
                        base_key = key[:-len(suffix)]
                        break
                break
        
        if entity_type is None or base_key is None:
            continue
        
        # Find corresponding name field
        name_key = f"{base_key}Name"
        entity_name = context.get(name_key, str(value))
        
        # Create entity
        entities.append(AffectedEntity(
            entity_type=entity_type,
            entity_id=str(value),
            entity_name=str(entity_name),
        ))
        
        processed_keys.add(key)
        processed_keys.add(name_key)
    
    return entities



def _validate_context(error_code: ErrorCode, context: Dict[str, Any]) -> None:
    """Validate that context contains all required keys for the error code.
    
    Args:
        error_code: The error code to validate against
        context: The context dictionary to validate
        
    Raises:
        ValueError: If required context keys are missing
    """
    definition = ERROR_DEFINITIONS.get(error_code)
    if definition is None:
        raise ValueError(f"Unknown error code: {error_code}")
    
    missing_keys = [
        key for key in definition.required_context_keys
        if key not in context
    ]
    
    if missing_keys:
        raise ValueError(
            f"Missing required context keys for {error_code.value}: {missing_keys}"
        )


def _format_message(template: str, context: Dict[str, Any]) -> str:
    """Format a message template with context values.
    
    Args:
        template: Message template with {placeholder} syntax
        context: Dictionary of values to substitute
        
    Returns:
        Formatted message string
    """
    try:
        return template.format(**context)
    except KeyError as e:
        # Return template with missing placeholder noted
        return f"{template} [missing: {e}]"


def build_error(error_code: ErrorCode, context: Dict[str, Any]) -> SolverErrorDetail:
    """Build a standardized error object from an error code and context.
    
    This function:
    1. Validates that context contains all required keys
    2. Formats Farsi and English messages using context values
    3. Extracts affected entities from context based on entity ID fields
    
    Args:
        error_code: The error code identifying the error type
        context: Dictionary containing all required context values
        
    Returns:
        SolverErrorDetail object with formatted messages and entities
        
    Raises:
        ValueError: If error_code is unknown or context is missing required keys
        
    Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    """
    # Validate context has required keys
    _validate_context(error_code, context)
    
    # Get error definition
    definition = ERROR_DEFINITIONS[error_code]
    
    # Format messages
    message_farsi = _format_message(definition.message_farsi_template, context)
    message_english = _format_message(definition.message_english_template, context)
    
    # Extract affected entities
    affected_entities = _extract_affected_entities(context)
    
    return SolverErrorDetail(
        error_code=error_code.value,
        severity=definition.severity.value,
        message_key=definition.message_key,
        message_farsi=message_farsi,
        message_english=message_english,
        affected_entities=affected_entities,
        context=context,
    )


def build_internal_error(exception: Exception) -> SolverErrorDetail:
    """Build an INTERNAL_ERROR for unexpected exceptions.
    
    This function handles unknown/unexpected errors by returning a generic
    error with the INTERNAL_ERROR code and including exception details
    in a debug field.
    
    Args:
        exception: The exception that was caught
        
    Returns:
        SolverErrorDetail with INTERNAL_ERROR code and debug info
        
    Requirements: 7.5
    """
    definition = ERROR_DEFINITIONS[ErrorCode.INTERNAL_ERROR]
    
    # Build context with debug information
    context = {
        "debug": {
            "exception_type": type(exception).__name__,
            "exception_message": str(exception),
        }
    }
    
    return SolverErrorDetail(
        error_code=ErrorCode.INTERNAL_ERROR.value,
        severity=definition.severity.value,
        message_key=definition.message_key,
        message_farsi=definition.message_farsi_template,
        message_english=definition.message_english_template,
        affected_entities=[],
        context=context,
    )
