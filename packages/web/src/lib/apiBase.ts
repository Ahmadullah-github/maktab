const configuredApiBase = import.meta.env.VITE_API_URL?.trim();

/** API root shared by every renderer client. */
export const API_BASE_URL = configuredApiBase || '/api';

function getOrigin(): string {
  return typeof window === 'undefined' ? 'http://127.0.0.1' : window.location.origin;
}

/** Build an absolute URL below the configured API root. */
export function buildApiUrl(endpoint: string): string {
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedEndpoint = endpoint.replace(/^\//, '');
  return new URL(normalizedEndpoint, new URL(normalizedBase, getOrigin())).toString();
}

/** Resolve an API-provided absolute or root-relative URL. */
export function resolveApiUrl(value: string): string {
  return new URL(value, getOrigin()).toString();
}
