// src/hooks/useTimetableGenerator.ts
import { useState, useCallback } from 'react';
import { dataService } from '../lib/dataService';
import { useTeacherStore } from '../stores/useTeacherStore';
import { useSubjectStore } from '../stores/useSubjectStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useClassStore } from '../stores/useClassStore';
import { useWizardStore } from '../stores/useWizardStore';

// Hook for handling timetable generation logic
export function useTimetableGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  const { teachers } = useTeacherStore();
  const { subjects } = useSubjectStore();
  const { rooms } = useRoomStore();
  const { classes } = useClassStore();
  const { schoolInfo, periodsInfo } = useWizardStore();

  const generateTimetable = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      // Prepare the data for timetable generation
      const timetableData = {
        teachers,
        subjects,
        rooms,
        classes,
        schoolInfo,
        periodsInfo,
        // Add any additional configuration needed for the solver
      };
      
      // Call the data service to generate the timetable
      const result = await dataService.generateTimetable(timetableData);
      
      setGenerationResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate timetable';
      setGenerationError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [teachers, subjects, rooms, classes, schoolInfo, periodsInfo]);

  const getGeneratedTimetable = useCallback(async () => {
    try {
      const result = await dataService.getGeneratedTimetable();
      setGenerationResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch timetable';
      setGenerationError(errorMessage);
      throw error;
    }
  }, []);

  return {
    isGenerating,
    generationResult,
    generationError,
    generateTimetable,
    getGeneratedTimetable
  };
}