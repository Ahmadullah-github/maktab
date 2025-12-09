"""
Phase 3.4: Smart Domain Filtering

Pre-filters incompatible teacher-room-time combinations to reduce search space.
"""
import structlog
from typing import List, Set, Tuple, Dict

log = structlog.get_logger()


class DomainFilter:
    """
    Filters out impossible combinations early to reduce search space.
    
    Uses compatibility matrices to quickly eliminate:
    - Teachers who can't teach at certain times
    - Rooms that don't meet requirements
    - Time slots that conflict with availability
    """
    
    def __init__(self, data, teacher_map, room_map, subject_map, class_map):
        """
        Initialize domain filter.
        
        Args:
            data: TimetableData object
            teacher_map: Dict mapping teacher IDs to indices
            room_map: Dict mapping room IDs to indices
            subject_map: Dict mapping subject IDs to indices
            class_map: Dict mapping class IDs to indices
        """
        self.data = data
        self.teacher_map = teacher_map
        self.room_map = room_map
        self.subject_map = subject_map
        self.class_map = class_map
        
        # Pre-compute compatibility matrices
        self.teacher_subject_compat = self._build_teacher_subject_compatibility()
        self.room_subject_compat = self._build_room_subject_compatibility()
        
        log.info("Domain filter initialized",
                 teacher_subject_pairs=len(self.teacher_subject_compat),
                 room_subject_pairs=len(self.room_subject_compat))
    
    def _build_teacher_subject_compatibility(self) -> Dict[Tuple[int, int], bool]:
        """
        Build teacher-subject compatibility matrix.
        
        Returns:
            Dict mapping (teacher_idx, subject_idx) -> can_teach (bool)
        """
        compat = {}
        
        for t_idx, teacher in enumerate(self.data.teachers):
            # Get teacher's subjects (primary + allowed)
            primary_subjects = set(teacher.primarySubjectIds)
            allowed_subjects = set(teacher.allowedSubjectIds or [])
            restrict_to_primary = teacher.restrictToPrimarySubjects if teacher.restrictToPrimarySubjects is not None else True
            
            for s_idx, subject in enumerate(self.data.subjects):
                # Check if teacher can teach this subject
                can_teach = False
                
                if subject.id in primary_subjects:
                    can_teach = True
                elif not restrict_to_primary and subject.id in allowed_subjects:
                    can_teach = True
                
                if can_teach:
                    compat[(t_idx, s_idx)] = True
        
        log.debug(f"Teacher-subject compatibility: {len(compat)} valid pairs")
        return compat
    
    def _build_room_subject_compatibility(self) -> Dict[Tuple[int, int], bool]:
        """
        Build room-subject compatibility matrix.
        
        Returns:
            Dict mapping (room_idx, subject_idx) -> is_compatible (bool)
        """
        compat = {}
        
        for r_idx, room in enumerate(self.data.rooms):
            for s_idx, subject in enumerate(self.data.subjects):
                # Check room type requirement
                if subject.requiredRoomType and room.type != subject.requiredRoomType:
                    continue
                
                # Check capacity (will check against class later)
                min_cap = subject.minRoomCapacity or 0
                if room.capacity < min_cap:
                    continue
                
                # Check required features
                req_features = set(subject.requiredFeatures or [])
                room_features = set(room.features or [])
                if not req_features.issubset(room_features):
                    continue
                
                # Compatible
                compat[(r_idx, s_idx)] = True
        
        log.debug(f"Room-subject compatibility: {len(compat)} valid pairs")
        return compat
    
    def can_teacher_teach_subject(self, teacher_idx: int, subject_idx: int) -> bool:
        """
        Quick lookup: Can this teacher teach this subject?
        
        Args:
            teacher_idx: Teacher index
            subject_idx: Subject index
            
        Returns:
            True if compatible, False otherwise
        """
        return (teacher_idx, subject_idx) in self.teacher_subject_compat
    
    def can_room_host_subject(self, room_idx: int, subject_idx: int, class_size: int) -> bool:
        """
        Quick lookup: Can this room host this subject for a class?
        
        Args:
            room_idx: Room index
            subject_idx: Subject index
            class_size: Number of students in class
            
        Returns:
            True if compatible, False otherwise
        """
        # Check basic subject compatibility
        if (room_idx, subject_idx) not in self.room_subject_compat:
            return False
        
        # Check capacity against class size
        room = self.data.rooms[room_idx]
        if room.capacity < class_size:
            return False
        
        return True
    
    def filter_teachers_for_request(self, subject_idx: int, allowed_teachers: List[int]) -> List[int]:
        """
        Filter teacher list to only compatible teachers.
        
        Args:
            subject_idx: Subject index
            allowed_teachers: List of potentially allowed teacher indices
            
        Returns:
            Filtered list of teacher indices
        """
        return [
            t_idx for t_idx in allowed_teachers
            if self.can_teacher_teach_subject(t_idx, subject_idx)
        ]
    
    def filter_rooms_for_request(self, subject_idx: int, class_size: int, allowed_rooms: List[int]) -> List[int]:
        """
        Filter room list to only compatible rooms.
        
        Args:
            subject_idx: Subject index
            class_size: Number of students
            allowed_rooms: List of potentially allowed room indices
            
        Returns:
            Filtered list of room indices
        """
        return [
            r_idx for r_idx in allowed_rooms
            if self.can_room_host_subject(r_idx, subject_idx, class_size)
        ]
    
    def get_stats(self) -> dict:
        """Get filtering statistics."""
        total_teacher_subject_combinations = len(self.data.teachers) * len(self.data.subjects)
        total_room_subject_combinations = len(self.data.rooms) * len(self.data.subjects)
        
        teacher_reduction = 1.0 - (len(self.teacher_subject_compat) / total_teacher_subject_combinations)
        room_reduction = 1.0 - (len(self.room_subject_compat) / total_room_subject_combinations)
        
        return {
            "teacher_subject_valid": len(self.teacher_subject_compat),
            "teacher_subject_total": total_teacher_subject_combinations,
            "teacher_reduction": f"{teacher_reduction * 100:.1f}%",
            "room_subject_valid": len(self.room_subject_compat),
            "room_subject_total": total_room_subject_combinations,
            "room_reduction": f"{room_reduction * 100:.1f}%"
        }
