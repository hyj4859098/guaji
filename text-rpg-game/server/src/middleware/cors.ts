import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

function getAllowedOrigins(): string[] {
  if (config.cors_origins) {
    return config.cors_origins.split(',').map(o => o.trim()).filter(Boolean);
  }
  return [];
}

export function cors(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;

  if (allowedOrigins.length === 0) {
    // 未配置 CORS_ORIGINS：开发模式允许所有，生产模式只允许同源
    if (process.env.NODE_ENV !== 'production') {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (origin) {
      // 生产环境无配置时拒绝跨域
      res.header('Access-Control-Allow-Origin', '');
    }
  } else if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}
