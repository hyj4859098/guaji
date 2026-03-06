/**
 * Express 应用工厂，供 app.ts 和测试使用
 * 不包含 DB 连接、WebSocket、HTTP 监听
 */
import express from 'express';
import * as path from 'path';
import helmet from 'helmet';
import { errorHandler } from './middleware/error';
import { cors } from './middleware/cors';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { responseValidator } from './middleware/response-validator';
import { logger } from './utils/logger';
import { apiLimiter } from './middleware/rate-limit';
import playerRouter from './api/player';
import userRouter from './api/user';
import equipRouter from './api/equip';
import bagRouter from './api/bag';
import monsterRouter from './api/monster';
import itemRouter from './api/item';
import levelExpRouter from './api/level_exp';
import mapRouter from './api/map';
import battleRouter from './api/battle';
import boostRouter from './api/boost';
import skillRouter from './api/skill';
import shopRouter from './api/shop';
import auctionRouter from './api/auction';
import bossRouter from './api/boss';
import rankRouter from './api/rank';
import pvpRouter from './api/pvp';
import configRouter from './api/config';
import adminRouter from './api/admin/index';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(requestLogger);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use(cors);
  app.use(express.json());
  app.use('/api', apiLimiter);

  if (process.env.NODE_ENV !== 'production') {
    app.use(responseValidator);
  }

  app.use('/', express.static(path.join(__dirname, '../../client')));
  app.use('/gm', express.static(path.join(__dirname, '../../client/gm')));

  app.post('/api/client-error', (req, res) => {
    const { message, stack, url, line, col, uid } = req.body || {};
    logger.warn('CLIENT ERROR', { message, stack, url, line, col, uid });
    res.json({ code: 0 });
  });

  app.get('/api/health', async (_req, res) => {
    let dbOk = false;
    try {
      const { getDB } = await import('./config/db');
      const db = getDB();
      await db.command({ ping: 1 });
      dbOk = true;
    } catch { /* db unreachable */ }

    const status = dbOk ? 'ok' : 'degraded';
    const code = dbOk ? 200 : 503;
    res.status(code).json({
      status,
      uptime: Math.floor(process.uptime()),
      db: dbOk ? 'connected' : 'disconnected',
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/player', playerRouter);
  app.use('/api/user', userRouter);
  app.use('/api/equip', equipRouter);
  app.use('/api/bag', bagRouter);
  app.use('/api/monster', monsterRouter);
  app.use('/api/item', itemRouter);
  app.use('/api/level_exp', levelExpRouter);
  app.use('/api/map', mapRouter);
  app.use('/api/battle', battleRouter);
  app.use('/api/boost', boostRouter);
  app.use('/api/skill', skillRouter);
  app.use('/api/shop', shopRouter);
  app.use('/api/auction', auctionRouter);
  app.use('/api/boss', bossRouter);
  app.use('/api/rank', rankRouter);
  app.use('/api/pvp', pvpRouter);
  app.use('/api/config', configRouter);

  app.use('/api/admin', adminRouter);

  app.use(errorHandler);
  app.use((req, res) => {
    res.header('Content-Type', 'application/json');
    errorHandler(new Error('Not Found'), req, res, () => {});
  });

  return app;
}
