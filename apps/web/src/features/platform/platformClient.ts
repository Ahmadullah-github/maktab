import type {
  PlatformCapabilities,
  PlatformSession,
} from './types';

const PLATFORM_API_BASE = (import.meta.env.VITE_PLATFORM_API_URL?.trim() || '/api/v1').replace(
  /\/$/,
  ''
);

function electronBridge() {
  return typeof window !== 'undefined' ? window.electron?.platform : undefined;
}

async function responseData<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const message = data?.error?.message || data?.detail || `Platform request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

async function browserRequest<T>(
  path: string,
  options: RequestInit = {},
  membershipId?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (membershipId) headers.set('X-Maktab-Membership', membershipId);
  const response = await fetch(`${PLATFORM_API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  return responseData<T>(response);
}

async function csrfToken(): Promise<string> {
  const response = await browserRequest<{ csrfToken: string }>('/auth/csrf');
  return response.csrfToken;
}

export const platformClient = {
  async login(username: string, password: string): Promise<PlatformSession> {
    const bridge = electronBridge();
    if (bridge) return bridge.login({ username, password });

    const csrf = await csrfToken();
    await browserRequest('/auth/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ username, password }),
    });
    return browserRequest<PlatformSession>('/me');
  },

  async me(): Promise<PlatformSession> {
    const bridge = electronBridge();
    return bridge ? bridge.request({ path: '/me' }) : browserRequest<PlatformSession>('/me');
  },

  async capabilities(membershipId: string): Promise<PlatformCapabilities> {
    const bridge = electronBridge();
    return bridge
      ? bridge.request({ path: '/capabilities', membershipId })
      : browserRequest<PlatformCapabilities>('/capabilities', {}, membershipId);
  },

  async logout(): Promise<void> {
    const bridge = electronBridge();
    if (bridge) {
      await bridge.logout();
      return;
    }
    const csrf = await csrfToken();
    await browserRequest('/auth/session/logout', {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf },
    });
  },
};
