import { afterEach, describe, expect, it } from 'vitest';

import type { ScheduledLesson } from '../types';
import {
  getHasUnsavedChanges,
  getInitialScheduleState,
  useScheduleStore,
} from './scheduleStore';

function lesson(overrides: Partial<ScheduledLesson> = {}): ScheduledLesson {
  return {
    day: 'Saturday' as ScheduledLesson['day'],
    periodIndex: 0,
    classId: 'c1',
    className: 'Class 1',
    subjectId: 's1',
    subjectName: 'Math',
    teacherIds: ['t1'],
    teacherNames: ['Teacher 1'],
    roomId: 'r1',
    roomName: 'Room 1',
    isFixed: false,
    periodsThisDay: 1,
    ...overrides,
  };
}

afterEach(() => {
  useScheduleStore.setState(getInitialScheduleState());
});

describe('atomic swap draft execution', () => {
  it('rejects the whole move plan when any exact lesson identity is stale', () => {
    const original = lesson();
    useScheduleStore.setState({
      lessons: [original],
      originalLessons: [original],
    });

    expect(() =>
      useScheduleStore.getState().executeCascadingSwap([
        {
          class_id: 'c1',
          subject_id: 's1',
          teacher_ids: ['different-teacher'],
          room_id: 'r1',
          is_fixed: false,
          from_day: 'Saturday',
          from_period: 0,
          to_day: 'Saturday',
          to_period: 1,
        },
      ])
    ).toThrow(/stale/);

    expect(useScheduleStore.getState().lessons).toEqual([original]);
    expect(useScheduleStore.getState().undoStack).toHaveLength(0);
  });

  it('applies every exact move as one undoable action', () => {
    const first = lesson();
    const second = lesson({
      classId: 'c2',
      subjectId: 's2',
      teacherIds: ['t2'],
      teacherNames: ['Teacher 2'],
      roomId: 'r2',
      roomName: 'Room 2',
      periodIndex: 1,
    });
    useScheduleStore.setState({
      lessons: [first, second],
      originalLessons: [first, second],
    });

    useScheduleStore.getState().executeCascadingSwap([
      {
        class_id: 'c1',
        subject_id: 's1',
        teacher_ids: ['t1'],
        room_id: 'r1',
        is_fixed: false,
        from_day: 'Saturday',
        from_period: 0,
        to_day: 'Saturday',
        to_period: 1,
      },
      {
        class_id: 'c2',
        subject_id: 's2',
        teacher_ids: ['t2'],
        room_id: 'r2',
        is_fixed: false,
        from_day: 'Saturday',
        from_period: 1,
        to_day: 'Saturday',
        to_period: 0,
      },
    ]);

    expect(useScheduleStore.getState().lessons.map((item) => item.periodIndex)).toEqual([1, 0]);
    expect(useScheduleStore.getState().undoStack).toHaveLength(1);
  });

  it('does not mark newer edits as saved when an older snapshot is acknowledged', () => {
    const savedSnapshot = lesson();
    const newerDraft = lesson({ periodIndex: 2 });
    useScheduleStore.setState({
      scheduleRevision: 3,
      lessons: [newerDraft],
      originalLessons: [savedSnapshot],
    });

    useScheduleStore.getState().markAsSaved(4, [savedSnapshot]);

    const state = useScheduleStore.getState();
    expect(state.lessons).toEqual([newerDraft]);
    expect(state.originalLessons).toEqual([savedSnapshot]);
    expect(state.scheduleRevision).toBe(4);
    expect(getHasUnsavedChanges(state)).toBe(true);
  });

  it('retains only edits made after an in-flight save snapshot', () => {
    const original = lesson();
    useScheduleStore.setState({
      scheduleRevision: 1,
      lessons: [original],
      originalLessons: [original],
    });

    const firstSwap = {
      lessonA: original,
      lessonB: null,
      slotA: { day: original.day, period: 0 },
      slotB: { day: original.day, period: 1 },
    };
    useScheduleStore.getState().executeSwap(firstSwap);
    const savedSnapshot = useScheduleStore.getState().lessons.map((item) => ({ ...item }));

    useScheduleStore.getState().executeSwap({
      lessonA: savedSnapshot[0],
      lessonB: null,
      slotA: { day: savedSnapshot[0].day, period: 1 },
      slotB: { day: savedSnapshot[0].day, period: 2 },
    });
    useScheduleStore.getState().markAsSaved(2, savedSnapshot);

    expect(useScheduleStore.getState().undoStack).toHaveLength(1);
    useScheduleStore.getState().undo();
    expect(useScheduleStore.getState().lessons).toEqual(savedSnapshot);
    expect(getHasUnsavedChanges(useScheduleStore.getState())).toBe(false);
  });
});
