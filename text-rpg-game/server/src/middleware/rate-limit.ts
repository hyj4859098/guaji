/**
 * 限流：防暴力破解、防滥用
 * 若 express-rate-limit 未安装（如部署环境 npm 异常），降级为透传中间件以保障服务可启动
 */
import type { Request, Response, NextFunction } from 'express';

type Middleware = (req: Request, res: Response, next: NextFunction) => void;
const noop: Middleware = (_req, _res, next) => next();
const isTest = process.env.NODE_ENV === 'test';

let authLimiter: Middleware;
let apiLimiter: Middleware;

try {
   
  const mod = require('express-rate-limit');
  const rateLimit = (typeof mod === 'function' ? mod : mod.default) as (opts: object) => Middleware;

  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 9999 : 10,
    message: { code: 429, msg: '请求过于频繁，请稍后再试', data: null },
    standardHeaders: true,
    legacyHeaders: false,
  });

  apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isTest ? 99999 : 100,
    message: { code: 429, msg: '请求过于频繁，请稍后再试', data: null },
    standardHeaders: true,
    legacyHeaders: false,
  });
} catch {
  authLimiter = noop;
  apiLimiter = noop;
}

export { authLimiter, apiLimiter };
