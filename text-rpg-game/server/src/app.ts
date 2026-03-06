import './load-env';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import { config, validateConfig } from './config';
import { connect, close } from './config/db';
import { logger } from './utils/logger';
import { wsManager } from './event/ws-manager';
import { wealthTitleService } from './service/wealth-title.service';
import { levelTitleService } from './service/level-title.service';
import { PlayerService } from './service/player.service';
import { setOnMapSubscribeChange, setSendToUser } from './event/boss-subscription';
import { pvpService } from './service/pvp.service';
import { tradeService } from './service/trade.service';
import jwt from 'jsonwebtoken';
import { createApp } from './create-app';

const app = createApp();

// 注入回调，打破 ws-manager 与 trade/boss-subscription 的循环依赖
wsManager.registerDisconnectHandler((uid) => tradeService.handleDisconnect(uid));
wsManager.registerMessageHandler('trade', (uid, data) => tradeService.handleMessage(uid, data));
setSendToUser(wsManager.sendToUser.bind(wsManager));

const server = createServer(app);

// 设置日志目录
const logDir = path.join(__dirname, '../logs');
logger.setLogDir(logDir);

// 全局异常捕获，崩溃时记录日志便于排查
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常导致服务器退出', { error: err?.message, stack: err?.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝导致服务器退出', { reason: String(reason) });
  process.exit(1);
});

function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
  // 从URL参数中获取token
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token');
  let uid: number | string | null = null;
  
  if (token) {
      try {
        // 验证token
        const decoded = jwt.verify(token, config.jwt_secret, { algorithms: ['HS256'] }) as { uid: number | string };
        uid = decoded.uid;
        
        // 添加连接到管理器
        wsManager.addConnection(uid, ws);
        logger.info(`WebSocket connected for user ${uid}`);

        // 称号玩家上线全服通报
        (async () => {
          try {
            const [wealthTitles, levelTitles] = await Promise.all([
              wealthTitleService.getAllTitles(uid),
              levelTitleService.getAllTitles(uid),
            ]);
            const titles = [...wealthTitles, ...levelTitles];
            if (titles.length === 0) return;
            const playerService = new PlayerService();
            const players = await playerService.list(uid);
            const name = players[0]?.name || '玩家';
            wsManager.broadcast({
              type: 'title_login',
              data: { titles, name }
            });
          } catch (e) {
            logger.error('称号上线通报失败', { uid, error: e instanceof Error ? e.message : String(e) });
          }
        })();
        
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        ws.close();
      }
    } else {
      logger.error('WebSocket connection without token');
      ws.close();
    }
  });
}

setOnMapSubscribeChange((mapId) => pvpService.notifyMapPlayersChanged(mapId));

async function startServer() {
  try {
    validateConfig();
    await connect();

    const wss = new WebSocketServer({ port: config.ws_port });
    wssRef = wss;
    setupWebSocket(wss);
    
    logger.info('Starting server...', {
      port: config.port,
      ws_port: config.ws_port,
      mongodb_db: config.mongodb.database,
    });

    server.listen(config.port, () => {
      logger.info(`HTTP Server running on port ${config.port}`);
      logger.info(`WebSocket Server running on port ${config.ws_port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Graceful shutdown
let wssRef: WebSocketServer | null = null;
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  wsManager.stopHeartbeat();
  if (wssRef) {
    wssRef.clients.forEach((ws) => ws.close());
    wssRef.close();
  }
  server.close(async () => {
    try { await close(); } catch { /* ignore */ }
    logger.info('Server shut down complete');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Forceful shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动服务器
startServer();
