// src/schemas/index.ts
// Main entry point for the schemas module

export * from './teacherSchema';
export * from './subjectSchema';
export * from './roomSchema';
export * from './classSchema';
export * from './wizardSchema';

// Export cross-entity validation schemas
export { createTimetableValidationSchema } from './teacherSchema';
export { createClassTimetableValidationSchema } from './classSchema';
export { createRoomTimetableValidationSchema } from './roomSchema';

// Export API validation helpers
export { validateApiResponse } from './teacherSchema';