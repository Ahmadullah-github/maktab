import {
  buildPhase2BackfillPlan,
  comparePlanToCanonicalSnapshot,
} from '../assignmentPhase2Planner';

describe('buildPhase2BackfillPlan', () => {
  it('prefers normalized assignment rows over legacy mirrors and reports contradictions', () => {
    const plan = buildPhase2BackfillPlan({
      teachers: [
        {
          id: 1,
          fullName: 'Teacher One',
          isDeleted: false,
          primarySubjectIds: [],
          allowedSubjectIds: [],
          classAssignments: [{ subjectId: 5, classIds: [9] }],
        },
        {
          id: 2,
          fullName: 'Teacher Two',
          isDeleted: false,
          primarySubjectIds: [],
          allowedSubjectIds: [],
          classAssignments: [],
        },
      ],
      classes: [
        {
          id: 9,
          name: 'Class 9',
          isDeleted: false,
          subjectRequirements: [{ subjectId: 5, periodsPerWeek: 4, teacherId: 2 }],
        },
      ],
      subjects: [{ id: 5, name: 'Math', isDeleted: false, periodsPerWeek: 4 }],
      normalizedAssignments: [
        {
          id: 10,
          teacherId: 1,
          classId: 9,
          subjectId: 5,
          periodsPerWeek: 4,
          isFixed: true,
          isDeleted: false,
        },
      ],
    });

    expect(plan.requirements).toEqual([
      {
        classId: 9,
        subjectId: 5,
        requiredPeriodsPerWeek: 4,
        allowSplitAssignment: false,
        derivation: 'class_requirement',
      },
    ]);

    expect(plan.assignments).toEqual([
      {
        classId: 9,
        subjectId: 5,
        teacherId: 1,
        assignedPeriodsPerWeek: 4,
        isFixed: true,
        source: 'migration',
        derivation: 'normalized_assignment',
      },
    ]);

    expect(
      plan.issues.some(
        (issue) =>
          issue.code === 'class_requirement_teacher_conflicts_with_normalized_assignment'
      )
    ).toBe(true);
  });

  it('infers capabilities from assignments and detects ambiguous teacher mirrors', () => {
    const plan = buildPhase2BackfillPlan({
      teachers: [
        {
          id: 1,
          fullName: 'Teacher One',
          isDeleted: false,
          primarySubjectIds: [],
          allowedSubjectIds: [],
          classAssignments: [{ subjectId: 3, classIds: [7] }],
        },
        {
          id: 2,
          fullName: 'Teacher Two',
          isDeleted: false,
          primarySubjectIds: [],
          allowedSubjectIds: [],
          classAssignments: [{ subjectId: 3, classIds: [7] }],
        },
      ],
      classes: [
        {
          id: 7,
          name: 'Class 7',
          isDeleted: false,
          subjectRequirements: [],
        },
      ],
      subjects: [{ id: 3, name: 'Science', isDeleted: false, periodsPerWeek: 2 }],
      normalizedAssignments: [],
    });

    expect(plan.requirements).toEqual([
      {
        classId: 7,
        subjectId: 3,
        requiredPeriodsPerWeek: 2,
        allowSplitAssignment: true,
        derivation: 'subject_default_for_teacher_mirror',
      },
    ]);

    expect(plan.assignments).toEqual([]);

    expect(
      plan.capabilities.map((row) => ({
        teacherId: row.teacherId,
        subjectId: row.subjectId,
        capabilityLevel: row.capabilityLevel,
      }))
    ).toEqual([
      { teacherId: 1, subjectId: 3, capabilityLevel: 'allowed' },
      { teacherId: 2, subjectId: 3, capabilityLevel: 'allowed' },
    ]);

    expect(
      plan.issues.some((issue) => issue.code === 'teacher_mirror_assignment_ambiguous')
    ).toBe(true);
  });
});

describe('comparePlanToCanonicalSnapshot', () => {
  it('reports missing rows and mismatches against the expected plan', () => {
    const plan = buildPhase2BackfillPlan({
      teachers: [
        {
          id: 1,
          fullName: 'Teacher One',
          isDeleted: false,
          primarySubjectIds: [2],
          allowedSubjectIds: [],
          classAssignments: [],
        },
      ],
      classes: [
        {
          id: 4,
          name: 'Class 4',
          isDeleted: false,
          subjectRequirements: [{ subjectId: 2, periodsPerWeek: 3, teacherId: 1 }],
        },
      ],
      subjects: [{ id: 2, name: 'Language', isDeleted: false, periodsPerWeek: 3 }],
      normalizedAssignments: [],
    });

    const report = comparePlanToCanonicalSnapshot(plan, {
      requirements: [
        {
          id: 100,
          classId: 4,
          subjectId: 2,
          requiredPeriodsPerWeek: 2,
          allowSplitAssignment: false,
        },
      ],
      capabilities: [],
      assignments: [],
    });

    expect(report.mismatchedRequirements).toHaveLength(1);
    expect(report.missingCapabilities).toHaveLength(1);
    expect(report.missingAssignments).toHaveLength(1);
  });
});
