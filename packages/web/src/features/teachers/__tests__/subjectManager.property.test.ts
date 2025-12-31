/**
 * Property-based tests for SubjectManager zone consistency
 *
 * Feature: teachers-feature, Property 4: Subject zone state consistency
 * For any set of subjects and any sequence of drag-drop operations between zones
 * (available, primary, allowed), each subject SHALL exist in exactly one zone at
 * any time. Moving a subject to a new zone SHALL remove it from its previous zone
 * and add it to the target zone.
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.6
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  getSubjectZone,
  moveSubjectToZone,
  type Subject,
  type SubjectZone,
} from '../components/SubjectManager';

/**
 * Generator for a Subject object
 */
const subjectArbitrary: fc.Arbitrary<Subject> = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  code: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
});

/**
 * Generator for unique subject IDs
 */
const uniqueSubjectIdsArbitrary = (maxLength: number): fc.Arbitrary<number[]> =>
  fc
    .array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength })
    .map((ids) => [...new Set(ids)]);

/**
 * Generator for a zone type
 */
const zoneArbitrary: fc.Arbitrary<SubjectZone> = fc.constantFrom('available', 'primary', 'allowed');

/**
 * Generator for a valid state (primary and allowed IDs with no overlap)
 */
const validStateArbitrary: fc.Arbitrary<{
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  allSubjectIds: number[];
}> = fc
  .array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 30 })
  .map((ids) => [...new Set(ids)])
  .chain((allIds) => {
    // Randomly partition into primary, allowed, and available
    return fc
      .tuple(fc.shuffledSubarray(allIds), fc.shuffledSubarray(allIds))
      .map(([primaryCandidates, allowedCandidates]) => {
        // Ensure no overlap between primary and allowed
        const primarySet = new Set(primaryCandidates);
        const allowedFiltered = allowedCandidates.filter((id) => !primarySet.has(id));
        return {
          primarySubjectIds: primaryCandidates,
          allowedSubjectIds: allowedFiltered,
          allSubjectIds: allIds,
        };
      });
  });

describe('SubjectManager Property Tests', () => {
  /**
   * Feature: teachers-feature, Property 4: Subject zone state consistency
   * Validates: Requirements 3.2, 3.3, 3.4, 3.6
   */
  describe('Property 4: Subject zone state consistency', () => {
    it('each subject should exist in exactly one zone at any time', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          ({ primarySubjectIds, allowedSubjectIds, allSubjectIds }) => {
            // For each subject, check it's in exactly one zone
            for (const subjectId of allSubjectIds) {
              const inPrimary = primarySubjectIds.includes(subjectId);
              const inAllowed = allowedSubjectIds.includes(subjectId);
              const inAvailable = !inPrimary && !inAllowed;

              // Count how many zones the subject is in
              const zoneCount = [inPrimary, inAllowed, inAvailable].filter(Boolean).length;
              expect(zoneCount).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getSubjectZone should return the correct zone for each subject', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          ({ primarySubjectIds, allowedSubjectIds, allSubjectIds }) => {
            for (const subjectId of allSubjectIds) {
              const zone = getSubjectZone(subjectId, primarySubjectIds, allowedSubjectIds);

              if (primarySubjectIds.includes(subjectId)) {
                expect(zone).toBe('primary');
              } else if (allowedSubjectIds.includes(subjectId)) {
                expect(zone).toBe('allowed');
              } else {
                expect(zone).toBe('available');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('moving a subject to a new zone should remove it from its previous zone', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          fc.integer({ min: 1, max: 1000 }),
          zoneArbitrary,
          ({ primarySubjectIds, allowedSubjectIds }, subjectId, targetZone) => {
            const { primary, allowed } = moveSubjectToZone(
              subjectId,
              targetZone,
              primarySubjectIds,
              allowedSubjectIds
            );

            // Subject should not be in both zones
            const inPrimary = primary.includes(subjectId);
            const inAllowed = allowed.includes(subjectId);

            expect(inPrimary && inAllowed).toBe(false);

            // Subject should be in the target zone (unless target is 'available')
            if (targetZone === 'primary') {
              expect(inPrimary).toBe(true);
              expect(inAllowed).toBe(false);
            } else if (targetZone === 'allowed') {
              expect(inPrimary).toBe(false);
              expect(inAllowed).toBe(true);
            } else {
              // 'available' - should be in neither
              expect(inPrimary).toBe(false);
              expect(inAllowed).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('moving a subject should preserve all other subjects in their zones', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          fc.integer({ min: 1, max: 1000 }),
          zoneArbitrary,
          ({ primarySubjectIds, allowedSubjectIds }, subjectId, targetZone) => {
            const { primary, allowed } = moveSubjectToZone(
              subjectId,
              targetZone,
              primarySubjectIds,
              allowedSubjectIds
            );

            // All other subjects in primary should still be there
            for (const id of primarySubjectIds) {
              if (id !== subjectId) {
                expect(primary).toContain(id);
              }
            }

            // All other subjects in allowed should still be there
            for (const id of allowedSubjectIds) {
              if (id !== subjectId) {
                expect(allowed).toContain(id);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('moving a subject to its current zone should be idempotent', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          ({ primarySubjectIds, allowedSubjectIds, allSubjectIds }) => {
            // Pick a subject that's in primary
            const primarySubject = primarySubjectIds[0];
            if (primarySubject !== undefined) {
              const { primary, allowed } = moveSubjectToZone(
                primarySubject,
                'primary',
                primarySubjectIds,
                allowedSubjectIds
              );

              // Should still be in primary, allowed unchanged
              expect(primary).toContain(primarySubject);
              expect(allowed).not.toContain(primarySubject);
            }

            // Pick a subject that's in allowed
            const allowedSubject = allowedSubjectIds[0];
            if (allowedSubject !== undefined) {
              const { primary, allowed } = moveSubjectToZone(
                allowedSubject,
                'allowed',
                primarySubjectIds,
                allowedSubjectIds
              );

              // Should still be in allowed, primary unchanged
              expect(allowed).toContain(allowedSubject);
              expect(primary).not.toContain(allowedSubject);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sequence of moves should maintain zone exclusivity', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          fc.array(fc.tuple(fc.integer({ min: 1, max: 100 }), zoneArbitrary), {
            minLength: 1,
            maxLength: 10,
          }),
          ({ primarySubjectIds, allowedSubjectIds }, moves) => {
            let primary = [...primarySubjectIds];
            let allowed = [...allowedSubjectIds];

            // Apply sequence of moves
            for (const [subjectId, targetZone] of moves) {
              const result = moveSubjectToZone(subjectId, targetZone, primary, allowed);
              primary = result.primary;
              allowed = result.allowed;

              // After each move, verify no subject is in both zones
              const primarySet = new Set(primary);
              for (const id of allowed) {
                expect(primarySet.has(id)).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('moving to available should remove from both primary and allowed', () => {
      fc.assert(
        fc.property(validStateArbitrary, ({ primarySubjectIds, allowedSubjectIds }) => {
          // Test with a subject from primary
          if (primarySubjectIds.length > 0) {
            const subjectId = primarySubjectIds[0];
            const { primary, allowed } = moveSubjectToZone(
              subjectId,
              'available',
              primarySubjectIds,
              allowedSubjectIds
            );

            expect(primary).not.toContain(subjectId);
            expect(allowed).not.toContain(subjectId);
          }

          // Test with a subject from allowed
          if (allowedSubjectIds.length > 0) {
            const subjectId = allowedSubjectIds[0];
            const { primary, allowed } = moveSubjectToZone(
              subjectId,
              'available',
              primarySubjectIds,
              allowedSubjectIds
            );

            expect(primary).not.toContain(subjectId);
            expect(allowed).not.toContain(subjectId);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('total subject count across zones should remain constant after moves', () => {
      fc.assert(
        fc.property(
          validStateArbitrary,
          fc.integer({ min: 1, max: 100 }),
          zoneArbitrary,
          ({ primarySubjectIds, allowedSubjectIds, allSubjectIds }, subjectId, targetZone) => {
            const initialPrimaryCount = primarySubjectIds.length;
            const initialAllowedCount = allowedSubjectIds.length;
            const wasInPrimary = primarySubjectIds.includes(subjectId);
            const wasInAllowed = allowedSubjectIds.includes(subjectId);

            const { primary, allowed } = moveSubjectToZone(
              subjectId,
              targetZone,
              primarySubjectIds,
              allowedSubjectIds
            );

            // If subject was already in a zone, total should stay same
            // If subject was new (in available), total might increase by 1
            const newTotal = primary.length + allowed.length;
            const oldTotal = initialPrimaryCount + initialAllowedCount;

            if (wasInPrimary || wasInAllowed) {
              // Subject was in a zone, moving it shouldn't change total
              // unless moving to available (which decreases by 1)
              if (targetZone === 'available') {
                expect(newTotal).toBe(oldTotal - 1);
              } else {
                expect(newTotal).toBe(oldTotal);
              }
            } else {
              // Subject was in available, moving to primary/allowed increases by 1
              if (targetZone === 'available') {
                expect(newTotal).toBe(oldTotal);
              } else {
                expect(newTotal).toBe(oldTotal + 1);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
