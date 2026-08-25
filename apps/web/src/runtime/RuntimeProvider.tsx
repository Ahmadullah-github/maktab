import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getRuntimeInfo, type RuntimeInfo } from './runtime';

const RuntimeContext = createContext<RuntimeInfo | null>(null);

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getRuntimeInfo().then(setRuntime).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, []);

  if (error) return <main role="alert">Unable to establish the application runtime: {error}</main>;
  if (!runtime) return <main aria-busy="true">Starting Maktab Timetable…</main>;
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeInfo {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRuntime must be used within RuntimeProvider');
  return value;
}

