// Lightweight client-side schema helpers used by the UI. The authoritative
// validation lives in the API package, but the frontend expects these helpers
// to exist for parsing, creating empty payloads, and collecting validation
// errors while building the wizard UI.

import { z } from "zod";

export enum DayOfWeek {
  Monday = "Monday",
  Tuesday = "Tuesday",
  Wednesday = "Wednesday",
  Thursday = "Thursday",
  Friday = "Friday",
  Saturday = "Saturday",
  Sunday = "Sunday",
}

// Minimal TimetableData placeholder type — the UI treats this as an opaque
// structure provided to the solver. Keep it `any` to avoid heavy duplication.
export type TimetableData = any;

export function parseTimetableData(payload: unknown): TimetableData {
  // In the UI we only need a best-effort parse; real validation happens on the server.
  return payload as TimetableData;
}

export function safeParseTimetableData(payload: unknown): {
  ok: boolean;
  data?: TimetableData;
  error?: any;
} {
  try {
    const data = parseTimetableData(payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export function createEmptyTimetableData(): TimetableData {
  return {
    subjects: [],
    teachers: [],
    rooms: [],
    classes: [],
    config: {},
    preferences: {},
  };
}

export function getValidationErrors(payload: unknown): string[] {
  // The UI calls this to display helpful error messages. For now return an
  // empty array — the API will return detailed errors during generation.
  // TODO: Mirror API validation logic if client-side checks are needed.
  return [];
}

export const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export default {
  DayOfWeek,
  parseTimetableData,
  safeParseTimetableData,
  createEmptyTimetableData,
  getValidationErrors,
};
