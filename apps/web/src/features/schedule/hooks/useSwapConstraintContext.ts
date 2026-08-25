import { API_BASE_URL } from '@/lib/apiBase';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type { SwapConstraintContext } from '../types';


async function fetchSwapConstraintContext(timetableId: number): Promise<SwapConstraintContext> {
  const response = await fetch(`${API_BASE_URL}/swap/context/${timetableId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.result as SwapConstraintContext;
}

export function useSwapConstraintContext(timetableId: number | null) {
  const mergeConstraintContext = useScheduleStore((state) => state.mergeConstraintContext);

  const query = useQuery({
    queryKey: ['swap-context', timetableId],
    queryFn: () => fetchSwapConstraintContext(timetableId!),
    enabled: timetableId !== null,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    mergeConstraintContext(query.data);
  }, [query.data, mergeConstraintContext]);

  return query;
}
