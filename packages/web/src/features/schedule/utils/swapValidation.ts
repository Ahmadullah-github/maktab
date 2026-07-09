import type {
  CellValidationStatus,
  DayOfWeek,
  RoomConstraintData,
  RoomMetadata,
  ScheduledLesson,
  SubjectConstraintData,
  SubjectMetadata,
  SwapOperation,
  SwapValidationResult,
  TeacherConstraintData,
  TeacherMetadata,
} from '../types';
import { DayOfWeek as DayOfWeekEnum } from '../types';

function createAvailabilityRecord(
  availability?: Partial<Record<DayOfWeek, boolean[]>>
): Record<DayOfWeek, boolean[]> {
  return {
    [DayOfWeekEnum.Saturday]: availability?.[DayOfWeekEnum.Saturday] ?? [],
    [DayOfWeekEnum.Sunday]: availability?.[DayOfWeekEnum.Sunday] ?? [],
    [DayOfWeekEnum.Monday]: availability?.[DayOfWeekEnum.Monday] ?? [],
    [DayOfWeekEnum.Tuesday]: availability?.[DayOfWeekEnum.Tuesday] ?? [],
    [DayOfWeekEnum.Wednesday]: availability?.[DayOfWeekEnum.Wednesday] ?? [],
    [DayOfWeekEnum.Thursday]: availability?.[DayOfWeekEnum.Thursday] ?? [],
    [DayOfWeekEnum.Friday]: availability?.[DayOfWeekEnum.Friday] ?? [],
  };
}

export function createTeacherConstraintMap(
  teachers: ReadonlyMap<string, TeacherMetadata>
): Map<string, TeacherConstraintData> {
  const constraintMap = new Map<string, TeacherConstraintData>();

  for (const [teacherId, teacher] of teachers) {
    constraintMap.set(teacherId, {
      id: teacherId,
      availability: createAvailabilityRecord(teacher.availability),
      timePreference: teacher.timePreference ?? 'None',
      maxConsecutivePeriods: teacher.maxConsecutivePeriods,
    });
  }

  return constraintMap;
}

export function createSubjectConstraintMap(
  subjects: ReadonlyMap<string, SubjectMetadata>
): Map<string, SubjectConstraintData> {
  const constraintMap = new Map<string, SubjectConstraintData>();

  for (const [subjectId, subject] of subjects) {
    constraintMap.set(subjectId, {
      id: subjectId,
      requiredRoomType: subject.requiredRoomType ?? null,
      isDifficult: subject.isDifficult ?? false,
    });
  }

  return constraintMap;
}

export function createRoomConstraintMap(
  rooms: ReadonlyMap<string, RoomMetadata>
): Map<string, RoomConstraintData> {
  const constraintMap = new Map<string, RoomConstraintData>();

  for (const [roomId, room] of rooms) {
    constraintMap.set(roomId, {
      id: roomId,
      type: room.type ?? 'normal',
    });
  }

  return constraintMap;
}

export function createSwapOperation(
  sourceLesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  targetLesson: ScheduledLesson | null
): SwapOperation {
  return {
    lessonA: sourceLesson,
    lessonB: targetLesson,
    slotA: {
      day: sourceLesson.day,
      period: sourceLesson.periodIndex,
    },
    slotB: targetSlot,
  };
}

export function getSwapValidationStatus(
  result: Pick<SwapValidationResult, 'isValid' | 'canProceedWithWarning'> | null | undefined
): CellValidationStatus {
  if (!result) {
    return null;
  }

  if (!result.isValid) {
    return 'blocked';
  }

  if (result.canProceedWithWarning) {
    return 'warning';
  }

  return 'valid';
}

export function canExecuteSwap(
  result: Pick<SwapValidationResult, 'isValid' | 'canProceedWithWarning'> | null | undefined
): boolean {
  const status = getSwapValidationStatus(result);
  return status === 'valid' || status === 'warning';
}

export function rankSwapValidationResult(result: SwapValidationResult): number {
  const status = getSwapValidationStatus(result);

  if (status === 'valid') {
    return 2;
  }

  if (status === 'warning') {
    return 1;
  }

  return 0;
}

export function collectAlternativeSwapSlots(
  validationResults: Iterable<[string, SwapValidationResult]>,
  limit = 5
): Array<{ day: DayOfWeek; period: number }> {
  const alternatives: Array<{ day: DayOfWeek; period: number }> = [];

  for (const [slotKey, result] of validationResults) {
    if (!canExecuteSwap(result)) {
      continue;
    }

    const [day, periodText] = slotKey.split('-');
    const period = Number.parseInt(periodText, 10);

    if (Number.isNaN(period)) {
      continue;
    }

    alternatives.push({ day: day as DayOfWeek, period });
  }

  return alternatives.slice(0, limit);
}
