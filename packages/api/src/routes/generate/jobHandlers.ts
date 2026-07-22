import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../../database/cache/cacheManager';
import { GenerationJobService } from '../../services/generationJob.service';
import { createOperationIssue, createOperationResponse } from '../../types/operation.types';
import { logger } from '../../utils/logger';

function diagnosticId(req: Request): string {
  return req.requestContext?.requestId ?? 'untracked';
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function handleCreateGenerationJob(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  try {
    const job = await GenerationJobService.getInstance(dataSource, cacheManager).enqueue(
      req.body,
      id
    );
    res.status(202).json(createOperationResponse('success', id, { data: { job } }));
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'GENERATION_JOB_CREATE_ERROR';
    const status = code === 'SOLVER_BUSY' ? 409 : code.endsWith('_NOT_FOUND') ? 404 : 422;
    res.status(status).json(
      createOperationResponse('failed', id, {
        issues: [createOperationIssue(code, 'request')],
        metadata: {
          activeJob: (error as { activeJob?: unknown }).activeJob ?? null,
        },
      })
    );
  }
}

export async function handleGetGenerationJob(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  const job = await GenerationJobService.getInstance(dataSource, cacheManager).get(req.params.id);
  if (!job) {
    res.status(404).json(
      createOperationResponse('failed', id, {
        issues: [createOperationIssue('GENERATION_JOB_NOT_FOUND', 'request')],
      })
    );
    return;
  }
  res.json(createOperationResponse('success', id, { data: { job } }));
}

export async function handleGetActiveGenerationJob(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  const job = await GenerationJobService.getInstance(dataSource, cacheManager).getActive();
  res.json(createOperationResponse('success', id, { data: { job } }));
}

export async function handleCancelGenerationJob(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  const job = await GenerationJobService.getInstance(dataSource, cacheManager).cancel(req.params.id);
  if (!job) {
    res.status(409).json(
      createOperationResponse('failed', id, {
        issues: [createOperationIssue('NO_CANCELLABLE_GENERATION', 'request')],
      })
    );
    return;
  }
  res.status(202).json(createOperationResponse('success', id, { data: { job } }));
}

export async function handleListCandidates(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  const source = req.query.sourceTimetableId
    ? positiveInteger(String(req.query.sourceTimetableId))
    : undefined;
  const candidates = await GenerationJobService.getInstance(
    dataSource,
    cacheManager
  ).listCandidates(source ?? undefined);
  res.json(createOperationResponse('success', id, { data: { candidates } }));
}

export async function handleGetCandidate(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  const candidateId = positiveInteger(req.params.id);
  const candidate = candidateId
    ? await GenerationJobService.getInstance(dataSource, cacheManager).getCandidate(candidateId)
    : null;
  if (!candidate) {
    res.status(404).json(
      createOperationResponse('failed', id, {
        issues: [createOperationIssue('TIMETABLE_CANDIDATE_NOT_FOUND', 'request')],
      })
    );
    return;
  }
  res.json(createOperationResponse('success', id, { data: { candidate } }));
}

export async function handleAcceptCandidate(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  try {
    const candidateId = positiveInteger(req.params.id);
    const accepted = candidateId
      ? await GenerationJobService.getInstance(dataSource, cacheManager).acceptCandidate(candidateId)
      : null;
    if (!accepted) {
      res.status(409).json(
        createOperationResponse('failed', id, {
          issues: [createOperationIssue('TIMETABLE_CANDIDATE_NOT_AVAILABLE', 'request')],
        })
      );
      return;
    }
    res.json(createOperationResponse('success', id, { data: accepted }));
  } catch (error) {
    logger.error(
      'Failed to accept timetable candidate',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json(
      createOperationResponse('failed', id, {
        issues: [createOperationIssue('TIMETABLE_CANDIDATE_ACCEPT_ERROR', 'saving')],
      })
    );
  }
}

export async function handleDiscardCandidate(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const id = diagnosticId(req);
  const candidateId = positiveInteger(req.params.id);
  const discarded = candidateId
    ? await GenerationJobService.getInstance(dataSource, cacheManager).discardCandidate(candidateId)
    : false;
  if (!discarded) {
    res.status(409).json(
      createOperationResponse('failed', id, {
        issues: [createOperationIssue('TIMETABLE_CANDIDATE_NOT_AVAILABLE', 'request')],
      })
    );
    return;
  }
  res.json(createOperationResponse('success', id, { data: { discarded: true } }));
}
