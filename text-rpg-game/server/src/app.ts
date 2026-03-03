import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { cors } from './middleware/cors';
import { connect } from './config/db';
import { generateToken } from './utils/helper';
import { success, fail } from './utils/response';
import { ErrorCode } from './utils/error';
import { logger } from './utils/logger';
import { wsManager } from './event/ws-manager';
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
import bossRouter from './api/boss';
import pvpRouter from './api/pvp';
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ port: config.ws_port });

// 设置日志目录
const logDir = path.join(__dirname, '../logs');
logger.setLogDir(logDir);

// 全局异常捕获，崩溃时记录日志便于排查
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常导致服务器退出', { error: err?.message, stack: err?.stack });
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝导致服务器退出', { reason: String(reason) });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 处理WebSocket连接
wss.on('connection', (ws: WebSocket, req) => {
  // 从URL参数中获取token
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token');
  let uid: number | string | null = null;
  
  if (token) {
      try {
        // 验证token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, config.jwt_secret) as { uid: number | string };
        uid = decoded.uid;
        
        // 添加连接到管理器
        wsManager.addConnection(uid, ws);
        logger.info(`WebSocket connected for user ${uid}`);
        
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        ws.close();
      }
    } else {
      logger.error('WebSocket connection without token');
      ws.close();
    }
  
});





app.use(cors);
app.use(express.json());

// 静态文件服务
// 主游戏前端
app.use('/', express.static(path.join(__dirname, '../../client')));
// GM 工具前端
app.use('/gm', express.static(path.join(__dirname, '../../client/gm')));

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
app.use('/api/boss', bossRouter);
app.use('/api/pvp', pvpRouter);

// 管理接口路由配置
const { adminAuth } = require('./middleware/auth');
const adminRouter = require('./api/admin/index').default;

// 其他管理接口（需要认证）
app.use('/api/admin', adminRouter);

// 错误处理中间件
app.use(errorHandler);

app.use((req, res) => {
  res.header('Content-Type', 'application/json');
  errorHandler(new Error('Not Found'), req, res, () => {});
});



// 启动服务器
async function startServer() {
  try {
    // 连接MongoDB
    await connect();
    
    console.log('Starting server...');
    console.log('Config:', {
      port: config.port,
      ws_port: config.ws_port,
      mongodb: {
        url: config.mongodb.url,
        database: config.mongodb.database
      }
    });

    // 启动服务器
    server.listen(config.port, () => {
      console.log(`HTTP Server running on port ${config.port}`);
      console.log(`WebSocket Server running on port ${config.ws_port}`);
      logger.info(`HTTP Server running on port ${config.port}`);
      logger.info(`WebSocket Server running on port ${config.ws_port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
