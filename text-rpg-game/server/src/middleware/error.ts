import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { toHttpStatus } from '../utils/response';

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'jwt', 'cookie'];

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      safe[key] = '[REDACTED]';
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

export function errorHandler(err: Error & { code?: number }, req: Request, res: Response, _next: NextFunction): void {
  const reqId = (req as unknown as Record<string, unknown>).requestId || '-';
  logger.error('Error occurred', {
    requestId: reqId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: redactBody(req.body)
  });

  if (err instanceof AppError) {
    res.status(toHttpStatus(err.code)).json({
      code: err.code,
      msg: err.message,
      data: null
    });
    return;
  }

  if (err.message === 'Not Found') {
    res.status(404).json({
      code: 404,
      msg: 'Not Found',
      data: null
    });
    return;
  }

  res.status(500).json({
    code: ErrorCode.SYSTEM_ERROR,
    msg: '服务器错误',
    data: null
  });
}
