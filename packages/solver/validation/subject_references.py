# ==============================================================================
#
#  Subject Reference Validation
#
#  Description:
#  Validates subject references in class requirements and custom subject
#  configuration.
#
# ==============================================================================

from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from models.input import TimetableData


# Valid grade categories for the Afghanistan education system
VALID_CATEGORIES: List[str] = ["Alpha-Primary", "Beta-Primary", "Middle", "High"]


def validate_subject_references(data: 'TimetableData') -> 'TimetableData':
    """
    Validate that all subject references in class requirements exist.
    
    Checks that:
    - All subject IDs referenced in class subjectRequirements exist in subjects list
    - Provides helpful suggestions for typos
    
    Args:
        data: TimetableData object to validate
        
    Returns:
        The validated TimetableData object
        
    Raises:
        ValueError: If unknown subject references are found
    """
    subject_ids = {s.id for s in data.subjects}
    
    for cls in data.classes:
        for subject_id in cls.subjectRequirements.keys():
            if subject_id not in subject_ids:
                # Find similar subjects to suggest
                similar = [s for s in subject_ids if subject_id.lower() in s.lower()]
                suggestion = f" Did you mean: {similar[0]}?" if similar else ""
                
                raise ValueError(
                    f"Subject Reference Error: Class '{cls.name}' (ID: {cls.id}) "
                    f"references unknown subject '{subject_id}'.{suggestion}"
                )
    
    return data


def validate_custom_subjects(data: 'TimetableData') -> 'TimetableData':
    """
    Validate custom subjects are properly configured.
    
    Checks that:
    - Custom subjects with customCategory have valid category values
    
    Args:
        data: TimetableData object to validate
        
    Returns:
        The validated TimetableData object
        
    Raises:
        ValueError: If custom subject configuration is invalid
    """
    for subject in data.subjects:
        if subject.isCustom:
            if subject.customCategory:
                if subject.customCategory not in VALID_CATEGORIES:
                    raise ValueError(
                        f"Custom Subject Error: Subject '{subject.name}' (ID: {subject.id}) "
                        f"has invalid customCategory '{subject.customCategory}'. "
                        f"Valid values: {', '.join(VALID_CATEGORIES)}"
                    )
    
    return data
