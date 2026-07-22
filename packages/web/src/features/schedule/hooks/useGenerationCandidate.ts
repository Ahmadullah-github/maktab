import { API_BASE_URL } from '@/lib/apiBase';
import { parseOperationResponse } from '@/types/operation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface TimetableCandidate {
  id: number;
  jobId: string;
  sourceTimetableId: number | null;
  acceptedTimetableId: number | null;
  status: 'available' | 'accepted' | 'discarded';
  sourceQualityScore: number | null;
  qualityScore: number | null;
  objectiveValue: number | null;
  bestBound: number | null;
  relativeGap: number | null;
  interrupted: boolean;
  metrics: Record<string, unknown>;
  createdAt: string;
}

interface CandidateResponse {
  candidate: TimetableCandidate;
}

interface AcceptedResponse extends CandidateResponse {
  timetable: { id: number };
}

async function operationFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const raw = await response.json().catch(() => null);
  const operation = parseOperationResponse<T>(raw);
  if (!response.ok || !operation || operation.outcome === 'failed' || !operation.data) {
    throw new Error(operation?.issues[0]?.code ?? 'TIMETABLE_CANDIDATE_ERROR');
  }
  return operation.data;
}

export function useGenerationCandidate(candidateId: number | null) {
  const queryClient = useQueryClient();
  const queryKey = ['generation-candidate', candidateId] as const;
  const candidateQuery = useQuery({
    queryKey,
    queryFn: () =>
      operationFetch<CandidateResponse>(`/generate/candidates/${candidateId}`).then(
        (result) => result.candidate
      ),
    enabled: candidateId !== null,
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      operationFetch<AcceptedResponse>(`/generate/candidates/${candidateId}/accept`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['generation-candidates'] });
    },
  });

  const discardMutation = useMutation({
    mutationFn: () =>
      operationFetch<{ discarded: boolean }>(`/generate/candidates/${candidateId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['generation-candidates'] });
    },
  });

  return {
    candidateQuery,
    acceptMutation,
    discardMutation,
  };
}

export function useLatestAvailableCandidate() {
  return useQuery({
    queryKey: ['generation-candidates'],
    queryFn: () =>
      operationFetch<{ candidates: TimetableCandidate[] }>('/generate/candidates').then(
        (result) => result.candidates.find((candidate) => candidate.status === 'available') ?? null
      ),
  });
}
