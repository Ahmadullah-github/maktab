import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { LOCAL_API_PREFIX } from '../constants';

function equalSecrets(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createLocalApiAuthMiddleware(expectedToken?: string) {
  if (process.env.NODE_ENV === 'production' && !expectedToken) {
    throw new Error('LOCAL_API_SESSION_TOKEN is required in production');
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.path.startsWith(LOCAL_API_PREFIX) || !expectedToken) {
      next();
      return;
    }

    const supplied = req.header('X-Maktab-Local-Token') || '';
    if (!equalSecrets(supplied, expectedToken)) {
      res.status(401).json({
        error: {
          code: 'LOCAL_API_UNAUTHORIZED',
          message: 'Local application authorization failed.',
          correlationId: req.requestContext?.requestId,
        },
      });
      return;
    }
    next();
  };
}

