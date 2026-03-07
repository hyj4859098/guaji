/**
 * 包装异步路由处理器，自动捕获异常并传递给 Express 错误中间件。
 * 消除路由中重复的 try/catch/next 样板代码。
 */
import { Request, Response, NextFunction } from 'express';

export function asyncHandler(fn: (req: any, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
