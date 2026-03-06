import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path } = req;
  const reqId = (req as unknown as Record<string, unknown>).requestId || '-';
  const uid = (req as unknown as Record<string, unknown>).uid || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    const msg = `${method} ${path} ${status} ${duration}ms`;
    logger[level](msg, { reqId, uid, status, duration });
  });

  next();
}
