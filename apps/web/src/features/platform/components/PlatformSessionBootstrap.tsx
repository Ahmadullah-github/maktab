import { useEffect } from 'react';

import { usePlatformSessionStore } from '../platformSessionStore';

export function PlatformSessionBootstrap() {
  const hydrate = usePlatformSessionStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return null;
}
