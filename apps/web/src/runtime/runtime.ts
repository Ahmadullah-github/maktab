export type ProductMode = 'desktop-timetable' | 'browser-platform' | 'development-full';

export interface RuntimeCapabilities {
  localTimetable: boolean;
  platform: boolean;
  nativePrint: boolean;
  backupRestore: boolean;
  licensing: boolean;
  updates: boolean;
  diagnostics: boolean;
}

export interface RuntimeInfo {
  schemaVersion: 1;
  productMode: ProductMode;
  packaged: boolean;
  appVersion: string;
  buildId: string;
  channel: 'development' | 'pilot' | 'stable';
  platform: string;
  arch: string;
  capabilities: RuntimeCapabilities;
}

const browserRuntime: RuntimeInfo = {
  schemaVersion: 1,
  productMode: import.meta.env.DEV ? 'development-full' : 'browser-platform',
  packaged: false,
  appVersion: import.meta.env.VITE_APP_VERSION || 'development',
  buildId: import.meta.env.VITE_BUILD_ID || 'development',
  channel: 'development',
  platform: 'browser',
  arch: 'browser',
  capabilities: {
    localTimetable: import.meta.env.DEV,
    platform: true,
    nativePrint: false,
    backupRestore: false,
    licensing: false,
    updates: false,
    diagnostics: false,
  },
};

let runtimePromise: Promise<RuntimeInfo> | null = null;

export function getRuntimeInfo(): Promise<RuntimeInfo> {
  if (!runtimePromise) {
    runtimePromise = window.maktab?.runtime.get().then((result) => {
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    }) ?? Promise.resolve(browserRuntime);
  }
  return runtimePromise;
}

export function isDesktopTimetable(runtime: RuntimeInfo): boolean {
  return runtime.productMode === 'desktop-timetable';
}

