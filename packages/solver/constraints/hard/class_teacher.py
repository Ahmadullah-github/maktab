# ==============================================================================
#
#  Class Teacher Constraint (استاد نگران)
#
#  Description:
#  Ensures that when a class has a designated class teacher (classTeacherId),
#  that teacher MUST be assigned to at least one lesson per week for that class.
#  
#  This is separate from singleTeacherMode:
#  - singleTeacherMode: Teacher teaches ALL subjects (Alpha-Primary grades 1-3)
#  - classTeacherId without singleTeacherMode: Teacher is class supervisor and
#    must teach at least 1 lesson/week from their qualified subjects
#
# ==============================================================================

from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model
import structlog

from ..base import HardConstraint
from ..registry import ConstraintRegistry, ConstraintStage


log = structlog.get_logger()


class ClassTeacherMinLessonConstraint(HardConstraint):
    """Ensures class teacher has at least one lesson per week for their class.
    
    When a class has classTeacherId set (and singleTeacherMode is False),
    the class teacher must be assigned to at least one lesson for that class
    from subjects they are qualified to teach.
    
    This constraint:
    1. Finds all requests (lessons) for the class where the class teacher CAN teach
    2. Creates boolean variables for "is class teacher assigned to this request"
    3. Adds constraint: SUM of these booleans >= 1
    """
    
    def __init__(self):
        super().__init__(name="class_teacher_min_lesson")
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        """Add class teacher minimum lesson constraints.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing solver state
        """
        data = context.get('data')
        if not data:
            return
        
        requests = context.get('requests', [])
        teacher_vars = context.get('teacher_vars', [])
        teacher_map = context.get('teacher_map', {})
        class_map = context.get('class_map', {})
        class_to_requests = context.get('class_to_requests', {})
        allowed_domains = context.get('allowed_domains', {})
        
        constraints_added = 0
        
        for cls in data.classes:
            # Skip if no class teacher assigned
            if not cls.classTeacherId:
                continue
            
            # Skip if singleTeacherMode is enabled (handled separately)
            # In singleTeacherMode, the class teacher already teaches ALL subjects
            if cls.singleTeacherMode:
                continue
            
            # Get class teacher index
            class_teacher_idx = teacher_map.get(cls.classTeacherId)
            if class_teacher_idx is None:
                log.warning(
                    "Class teacher not found in teacher_map",
                    class_id=cls.id,
                    class_teacher_id=cls.classTeacherId
                )
                continue
            
            # Find all requests for this class where class teacher can teach
            class_requests = class_to_requests.get(cls.id, [])
            
            # Collect boolean variables: "is class teacher assigned to this request?"
            class_teacher_assigned_vars = []
            
            for r_idx in class_requests:
                req = requests[r_idx]
                subject_id = req['subject_id']
                domain_key = (cls.id, subject_id)
                
                # Check if class teacher is in allowed teachers for this subject
                domain_info = allowed_domains.get(domain_key, {})
                allowed_teachers = domain_info.get('teachers', [])
                
                if class_teacher_idx in allowed_teachers:
                    # Create boolean: teacher_var[r_idx] == class_teacher_idx
                    is_class_teacher = model.NewBoolVar(
                        f'is_class_teacher_{cls.id}_{r_idx}'
                    )
                    model.Add(
                        teacher_vars[r_idx] == class_teacher_idx
                    ).OnlyEnforceIf(is_class_teacher)
                    model.Add(
                        teacher_vars[r_idx] != class_teacher_idx
                    ).OnlyEnforceIf(is_class_teacher.Not())
                    
                    class_teacher_assigned_vars.append(is_class_teacher)
            
            # Add constraint: at least one lesson must be assigned to class teacher
            if class_teacher_assigned_vars:
                model.Add(sum(class_teacher_assigned_vars) >= 1)
                constraints_added += 1
                log.debug(
                    "Added class teacher constraint",
                    class_id=cls.id,
                    class_teacher_id=cls.classTeacherId,
                    possible_lessons=len(class_teacher_assigned_vars)
                )
            else:
                # This should have been caught by validation, but log warning
                log.warning(
                    "Class teacher cannot teach any subject for class",
                    class_id=cls.id,
                    class_teacher_id=cls.classTeacherId
                )
        
        if constraints_added > 0:
            log.info(
                "Class teacher constraints applied",
                constraints_added=constraints_added
            )
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied."""
        if not self.enabled:
            return False
        
        data = context.get('data')
        if not data:
            return False
        
        # Check if any class has a class teacher (without singleTeacherMode)
        for cls in data.classes:
            if cls.classTeacherId and not cls.singleTeacherMode:
                return True
        
        return False


def register_class_teacher_constraint(registry: ConstraintRegistry = None) -> None:
    """Register the class teacher constraint with the registry.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(ClassTeacherMinLessonConstraint(), ConstraintStage.ESSENTIAL)
