# ==============================================================================
#
#  Progress Reporter for Timetable Solver
#
#  Description:
#  Emits real-time progress updates during timetable generation. Progress updates
#  are written to stdout in JSON format for the API to forward to connected clients.
#
#  Requirements: 5.1, 5.2, 5.5
#
# ==============================================================================

from enum import Enum
from typing import Dict, Tuple


class SolveStage(str, Enum):
    """Stages of the timetable solving process.
    
    Each stage represents a distinct phase of the solver execution:
    - VALIDATION: Input data validation (0-10%)
    - MODEL_BUILDING: Building the constraint model (10-25%)
    - SOLVING_PHASE_1: Initial solving phase (25-70%)
    - SOLVING_PHASE_2: Optimization phase (70-95%)
    - FORMATTING: Formatting the output (95-100%)
    
    Requirements: 5.2
    """
    VALIDATION = "validation"
    MODEL_BUILDING = "modelBuilding"
    SOLVING_PHASE_1 = "solvingPhase1"
    SOLVING_PHASE_2 = "solvingPhase2"
    FORMATTING = "formatting"


# ==============================================================================
# Farsi Translations for Stages
# Requirements: 5.5
# ==============================================================================

STAGE_FARSI: Dict[SolveStage, str] = {
    SolveStage.VALIDATION: "در حال اعتبارسنجی...",
    SolveStage.MODEL_BUILDING: "در حال ساخت مدل...",
    SolveStage.SOLVING_PHASE_1: "در حال حل (مرحله ۱)...",
    SolveStage.SOLVING_PHASE_2: "در حال حل (مرحله ۲)...",
    SolveStage.FORMATTING: "در حال آماده‌سازی نتیجه...",
}


# ==============================================================================
# Stage Percent Ranges
# Requirements: 5.2
# ==============================================================================

STAGE_PERCENT_RANGES: Dict[SolveStage, Tuple[int, int]] = {
    SolveStage.VALIDATION: (0, 10),
    SolveStage.MODEL_BUILDING: (10, 25),
    SolveStage.SOLVING_PHASE_1: (25, 70),
    SolveStage.SOLVING_PHASE_2: (70, 95),
    SolveStage.FORMATTING: (95, 100),
}


# ==============================================================================
# Progress Reporter Class
# Requirements: 5.1, 5.2, 5.5
# ==============================================================================

import json
import sys
import time
from typing import Optional


class ProgressReporter:
    """Reports progress updates during timetable solving.
    
    Emits JSON-formatted progress updates to stdout that include:
    - type: Always "progress"
    - stage: Current stage identifier
    - stageFarsi: Localized stage name in Farsi
    - percentComplete: Overall progress percentage (0-100)
    - estimatedSecondsRemaining: Estimated time to completion
    
    Requirements: 5.1, 5.2, 5.5
    """
    
    def __init__(self) -> None:
        """Initialize the progress reporter.
        
        Sets up timing information for progress tracking and estimation.
        """
        self.start_time: float = time.time()
        self.last_update_time: float = 0.0
        self.current_stage: Optional[SolveStage] = None
    
    def _estimate_remaining(self, overall_percent: float) -> Optional[int]:
        """Estimate remaining seconds based on elapsed time and progress.
        
        Args:
            overall_percent: Current overall progress percentage (0-100)
            
        Returns:
            Estimated seconds remaining, or None if cannot estimate
        """
        import math
        
        if overall_percent <= 0:
            return None
        
        elapsed = time.time() - self.start_time
        if elapsed <= 0:
            return None
        
        # Calculate rate of progress (percent per second)
        rate = overall_percent / elapsed
        
        if rate <= 0:
            return None
        
        # Estimate remaining time
        remaining_percent = 100 - overall_percent
        estimated_remaining = remaining_percent / rate
        
        # Handle infinity or very large values that can't be converted to int
        if math.isinf(estimated_remaining) or estimated_remaining > 2**31:
            return None
        
        return int(estimated_remaining)
    
    def report_stage(self, stage: SolveStage, percent_within_stage: float = 0.0) -> None:
        """Report progress for a stage.
        
        Calculates overall percentage from stage ranges and emits a JSON
        progress update to stdout.
        
        Args:
            stage: The current solving stage
            percent_within_stage: Progress within the current stage (0.0 to 1.0)
            
        Requirements: 5.1, 5.2, 5.5
        """
        # Get the percent range for this stage
        start_pct, end_pct = STAGE_PERCENT_RANGES[stage]
        
        # Clamp percent_within_stage to valid range
        percent_within_stage = max(0.0, min(1.0, percent_within_stage))
        
        # Calculate overall percentage
        overall_percent = start_pct + (end_pct - start_pct) * percent_within_stage
        
        # Build the progress update
        update = {
            "type": "progress",
            "stage": stage.value,
            "stageFarsi": STAGE_FARSI[stage],
            "percentComplete": int(overall_percent),
            "estimatedSecondsRemaining": self._estimate_remaining(overall_percent)
        }
        
        # Write to stdout as JSON line
        print(json.dumps(update, ensure_ascii=False), flush=True)
        
        # Update tracking state
        self.last_update_time = time.time()
        self.current_stage = stage
    
    def report_intermediate(self, percent_within_stage: float) -> None:
        """Report intermediate progress within the current stage.
        
        Only emits an update if 5+ seconds have passed since the last update.
        This prevents flooding the output with too many progress updates during
        long-running solving phases.
        
        Args:
            percent_within_stage: Progress within the current stage (0.0 to 1.0)
            
        Requirements: 5.3
        """
        # Only emit if we have a current stage
        if self.current_stage is None:
            return
        
        # Only emit if 5+ seconds since last update
        if time.time() - self.last_update_time < 5:
            return
        
        # Delegate to report_stage with the current stage
        self.report_stage(self.current_stage, percent_within_stage)
