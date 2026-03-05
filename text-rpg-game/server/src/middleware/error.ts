import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });

  if (err instanceof AppError) {
    // 根据错误类型选择适当的 HTTP 状态码
    let statusCode = 500;
    if (err.code >= 40000 && err.code < 50000) {
      statusCode = 400;
    } else if (err.code >= 50000) {
      statusCode = 500;
    }
    
    res.status(statusCode).json({
      code: err.code,
      msg: err.message,
      data: null
    });
    return;
  }

  // 处理其他类型的错误
  res.status(500).json({
    code: ErrorCode.SYSTEM_ERROR,
    msg: '服务器错误',
    data: null
  });
}
