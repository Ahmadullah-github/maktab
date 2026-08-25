import { create } from 'zustand';

import { platformClient } from './platformClient';
import type { PlatformCapabilities, PlatformMembership, PlatformSession } from './types';

type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

interface PlatformSessionState {
  status: SessionStatus;
  session: PlatformSession | null;
  activeMembership: PlatformMembership | null;
  capabilities: PlatformCapabilities | null;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectMembership: (membershipId: string) => Promise<void>;
}

const MEMBERSHIP_KEY = 'maktab_active_membership';

function chooseMembership(session: PlatformSession): PlatformMembership | null {
  const active = session.memberships.filter((membership) => membership.status === 'active');
  const preferredId = localStorage.getItem(MEMBERSHIP_KEY);
  return active.find((membership) => membership.id === preferredId) || active[0] || null;
}

async function loadSessionState(session: PlatformSession) {
  const activeMembership = chooseMembership(session);
  const capabilities = activeMembership
    ? await platformClient.capabilities(activeMembership.id)
    : null;
  if (activeMembership) localStorage.setItem(MEMBERSHIP_KEY, activeMembership.id);
  return { session, activeMembership, capabilities };
}

export const usePlatformSessionStore = create<PlatformSessionState>((set, get) => ({
  status: 'idle',
  session: null,
  activeMembership: null,
  capabilities: null,
  error: null,

  hydrate: async () => {
    if (get().status !== 'idle') return;
    set({ status: 'loading', error: null });
    try {
      const state = await loadSessionState(await platformClient.me());
      set({ status: 'authenticated', error: null, ...state });
    } catch {
      set({ status: 'anonymous', session: null, activeMembership: null, capabilities: null });
    }
  },

  login: async (username, password) => {
    set({ status: 'loading', error: null });
    try {
      const state = await loadSessionState(await platformClient.login(username, password));
      set({ status: 'authenticated', error: null, ...state });
    } catch (error) {
      set({
        status: 'anonymous',
        session: null,
        activeMembership: null,
        capabilities: null,
        error: error instanceof Error ? error.message : 'Unable to sign in',
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await platformClient.logout();
    } finally {
      localStorage.removeItem(MEMBERSHIP_KEY);
      set({
        status: 'anonymous',
        session: null,
        activeMembership: null,
        capabilities: null,
        error: null,
      });
    }
  },

  selectMembership: async (membershipId) => {
    const membership = get().session?.memberships.find(
      (candidate) => candidate.id === membershipId && candidate.status === 'active'
    );
    if (!membership) return;
    set({ status: 'loading', error: null });
    try {
      const capabilities = await platformClient.capabilities(membership.id);
      localStorage.setItem(MEMBERSHIP_KEY, membership.id);
      set({ status: 'authenticated', activeMembership: membership, capabilities });
    } catch (error) {
      set({
        status: 'authenticated',
        error: error instanceof Error ? error.message : 'Unable to change school',
      });
    }
  },
}));
