export interface PlatformAccount {
  id: string;
  username: string;
  email: string;
  phone: string;
  display_name: string;
  must_change_password: boolean;
}

export interface PlatformRole {
  code: string;
  name: string;
}

export interface PlatformMembership {
  id: string;
  tenant_id: string;
  tenant_name: string;
  school_unit_id: string | null;
  school_unit_name: string | null;
  status: 'active' | 'suspended' | 'ended';
  roles: PlatformRole[];
}

export interface PlatformSession {
  account: PlatformAccount;
  memberships: PlatformMembership[];
}

export interface CapabilityModule {
  code: string;
  actions: string[];
}

export interface PlatformCapabilities {
  membership: PlatformMembership;
  permissions: string[];
  modules: CapabilityModule[];
}

export interface PlatformBridgeRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  membershipId?: string;
}

declare global {
  interface Window {
    electron?: {
      isElectron: true;
      platform?: {
        login: (credentials: { username: string; password: string }) => Promise<PlatformSession>;
        request: <T>(request: PlatformBridgeRequest) => Promise<T>;
        logout: () => Promise<{ status: string }>;
      };
    };
  }
}
