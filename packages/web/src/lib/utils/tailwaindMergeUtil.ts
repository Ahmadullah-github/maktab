import clsx from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A small helper that composes class names and resolves Tailwind conflicts.
 * Many components import `cn` from this path; keep the filename and export name
 * to match existing imports (note the intentionally misspelled filename used
 * across the repo: `tailwaindMergeUtil`).
 */
export function cn(...inputs: Array<any>): string {
  return twMerge(clsx(...inputs));
}

export default cn;
