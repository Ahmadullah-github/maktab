/**
 * Shared Assignment Components
 *
 * Phase 1.4: Shared UI Components
 * Phase 4.3: Conflict Detection Components
 *
 * Reusable components for the tri-directional assignment system.
 * These components maintain consistent styling and behavior across
 * teacher-centric, subject-centric, and class-centric views.
 */

// Status & Compatibility Badges
export { AssignmentStatusBadge } from './AssignmentStatusBadge';
export type { AssignmentStatusBadgeProps } from './AssignmentStatusBadge';

export { CompatibilityBadge } from './CompatibilityBadge';
export type { CompatibilityBadgeProps } from './CompatibilityBadge';

// Selectors
export { TeacherSelector } from './TeacherSelector';
export type { TeacherSelectorProps } from './TeacherSelector';

export { ClassSelector } from './ClassSelector';
export type { ClassSelectorProps } from './ClassSelector';

export { SubjectSelector } from './SubjectSelector';
export type { SubjectSelectorProps } from './SubjectSelector';

// Workload Preview
export { WorkloadImpactPreview } from './WorkloadImpactPreview';
export type { WorkloadImpactPreviewProps } from './WorkloadImpactPreview';

// Conflict Display (Phase 4.3)
export { ConflictAlert } from './ConflictAlert';
export type { ConflictAlertProps } from './ConflictAlert';
