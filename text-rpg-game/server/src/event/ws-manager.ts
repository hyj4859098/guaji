import { WebSocket } from 'ws';
import { Uid } from '../types/index';
import { config } from '../config/index';
import { logger } from '../utils/logger';
import { subscribeBoss, unsubscribeBoss } from './boss-subscription';
import { recordKicked } from '../utils/kick-cooldown';
import { escapeHtml } from '../utils/input-sanitize';
import { toUidKey } from '../utils/uid-key';

interface ConnectionInfo {
  ws: WebSocket;
  lastHeartbeat: number;
  messageQueue: any[];
  msgTimestamps: number[];
}

type DisconnectHandler = (uid: Uid) => void;
type MessageHandler = (uid: Uid, data: any) => void;

class WSManager {
  private connections = new Map<string, ConnectionInfo>();
  private maxConnections = config.ws.maxConnections;
  private maxMessageQueueSize = config.ws.maxMessageQueueSize;
  private heartbeatInterval = config.ws.heartbeatInterval;
  private heartbeatTimeout = config.ws.heartbeatTimeout;
  private msgRateWindowMs = config.ws.msgRateWindowMs;
  private msgRateMax = config.ws.msgRateMax;
  private disconnectHandlers: DisconnectHandler[] = [];
  private messageHandlers = new Map<string, MessageHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeatCheck();
  }

  /** 注册断线回调（由 app 在启动时注入，避免循环依赖） */
  registerDisconnectHandler(fn: DisconnectHandler): void {
    this.disconnectHandlers.push(fn);
  }

  /** 注册消息处理器（由 app 在启动时注入，避免循环依赖） */
  registerMessageHandler(type: string, fn: MessageHandler): void {
    this.messageHandlers.set(type, fn);
  }

  private notifyDisconnect(uid: Uid): void {
    this.disconnectHandlers.forEach((fn) => fn(uid));
  }

  addConnection(uid: Uid, ws: WebSocket) {
    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      logger.warn('连接数达到上限', { maxConnections: this.maxConnections });
      ws.close(429, 'Too many connections');
      return;
    }

    const key = toUidKey(uid);
    const existing = this.connections.get(key);
    // 重复登录：踢掉旧连接，记录冷却防止恶意刷登录
    if (existing) {
      recordKicked(uid);
      const oldWs = existing.ws;
      try {
        oldWs.send(JSON.stringify({ type: 'kick', data: { reason: '账号在其他地方登录，30秒内无法再次登录' } }));
        // 延迟关闭，确保客户端收到并处理 kick 消息后再断开
        const t = setTimeout(() => {
          try { oldWs.close(4000, 'Duplicate login'); } catch { /* ignore */ }
        }, 200);
        (t as NodeJS.Timeout).unref();
      } catch {
        /* ignore */
      }
      this.connections.delete(key);
      this.notifyDisconnect(uid);
      logger.info('踢掉旧连接（重复登录）', { uid });
    }

    const connectionInfo: ConnectionInfo = {
      ws,
      lastHeartbeat: Date.now(),
      messageQueue: [],
      msgTimestamps: []
    };

    this.connections.set(key, connectionInfo);
    logger.info('新的WebSocket连接', { uid, connections: this.connections.size });

    ws.on('close', () => {
      const cur = this.connections.get(key);
      if (cur && cur.ws === ws) {
        this.connections.delete(key);
        logger.info('WebSocket连接关闭', { uid, connections: this.connections.size });
        this.notifyDisconnect(uid);
      }
    });

    // 监听错误
    ws.on('error', (error) => {
      logger.error('WebSocket错误', { uid, error: error instanceof Error ? error.message : String(error) });
      const cur = this.connections.get(key);
      if (cur && cur.ws === ws) this.connections.delete(key);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'heartbeat') {
          connectionInfo.lastHeartbeat = Date.now();
          try { ws.send(JSON.stringify({ type: 'heartbeat' })); } catch {}
          return;
        }

        if (this.isRateLimited(connectionInfo)) {
          try { ws.send(JSON.stringify({ type: 'error', data: { msg: '消息过于频繁，请稍后再试' } })); } catch {}
          return;
        }

        if (message.type === 'chat') {
          const rawText = String(message.data?.text || '').trim().slice(0, 200);
          const rawName = String(message.data?.name || '???').trim().slice(0, 32);
          if (rawText) {
            this.broadcast({
              type: 'chat',
              data: { uid: String(uid), name: escapeHtml(rawName), text: escapeHtml(rawText), time: Date.now() }
            });
          }
        } else if (message.type === 'subscribe_boss') {
          const mapId = Number(message.data?.map_id);
          if (mapId > 0) subscribeBoss(uid, mapId);
        } else if (message.type === 'unsubscribe_boss') {
          unsubscribeBoss(uid);
        } else {
          const handler = this.messageHandlers.get(message.type);
          if (handler) handler(uid, message.data);
        }
      } catch (error) {
        logger.error('解析WebSocket消息失败', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    // 处理消息队列
    this.processMessageQueue(uid);
  }

  removeConnection(uid: Uid) {
    this.connections.delete(toUidKey(uid));
    logger.info('移除WebSocket连接', { uid, connections: this.connections.size });
  }

  getConnection(uid: Uid): WebSocket | undefined {
    const connectionInfo = this.connections.get(toUidKey(uid));
    return connectionInfo?.ws;
  }

  sendToUser(uid: Uid, message: any) {
    const key = toUidKey(uid);
    const connectionInfo = this.connections.get(key);
    if (connectionInfo) {
      if (connectionInfo.ws.readyState === WebSocket.OPEN) {
        try {
          connectionInfo.ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('发送消息失败', { uid, error: error instanceof Error ? error.message : String(error) });
          // 将消息加入队列，稍后重试（队列有上限，防止内存无限增长）
          if (connectionInfo.messageQueue.length >= this.maxMessageQueueSize) {
            connectionInfo.messageQueue.shift();
          }
          connectionInfo.messageQueue.push(message);
        }
      } else {
        // 连接未就绪，将消息加入队列
        if (connectionInfo.messageQueue.length >= this.maxMessageQueueSize) {
          connectionInfo.messageQueue.shift();
        }
        connectionInfo.messageQueue.push(message);
      }
    } else {
      logger.warn('WebSocket 连接不存在，消息未发送', { uid, type: message?.type, event: message?.data?.event, connectionKeys: Array.from(this.connections.keys()) });
    }
  }

  broadcast(message: any) {
    this.connections.forEach((connectionInfo, uid) => {
      if (connectionInfo.ws.readyState === WebSocket.OPEN) {
        try {
          connectionInfo.ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('广播消息失败', { uid, error: error instanceof Error ? error.message : String(error) });
        }
      }
    });
  }

  private isRateLimited(conn: ConnectionInfo): boolean {
    const now = Date.now();
    conn.msgTimestamps.push(now);
    const cutoff = now - this.msgRateWindowMs;
    while (conn.msgTimestamps.length > 0 && conn.msgTimestamps[0] < cutoff) {
      conn.msgTimestamps.shift();
    }
    return conn.msgTimestamps.length > this.msgRateMax;
  }

  private processMessageQueue(uid: Uid) {
    const connectionInfo = this.connections.get(toUidKey(uid));
    if (!connectionInfo) return;

    const process = () => {
      if (connectionInfo.ws.readyState === WebSocket.OPEN && connectionInfo.messageQueue.length > 0) {
        const message = connectionInfo.messageQueue.shift();
        if (message) {
          try {
            connectionInfo.ws.send(JSON.stringify(message));
          } catch (error) {
            logger.error('处理消息队列失败', { uid, error: error instanceof Error ? error.message : String(error) });
            // 消息处理失败，重新加入队列
            connectionInfo.messageQueue.unshift(message);
          }
        }
      }

      // 继续处理队列
      if (connectionInfo.messageQueue.length > 0) {
        const t = setTimeout(() => process(), 100);
        (t as NodeJS.Timeout).unref();
      }
    };

    process();
  }

  private startHeartbeatCheck() {
    this.heartbeatTimer = setInterval(async () => {
      const now = Date.now();
      // 使用 Array.from 转换为数组，避免在遍历过程中修改 Map
      const connections = Array.from(this.connections.entries());
      for (const [uid, connectionInfo] of connections) {
        // 发送心跳包
        if (connectionInfo.ws.readyState === WebSocket.OPEN) {
          try {
            connectionInfo.ws.send(JSON.stringify({ type: 'heartbeat' }));
          } catch (error) {
            logger.error('发送心跳失败', { uid, error: error instanceof Error ? error.message : String(error) });
            this.connections.delete(toUidKey(uid));
            this.notifyDisconnect(uid);
          }
        }

        // 检查心跳超时
        if (now - connectionInfo.lastHeartbeat > this.heartbeatTimeout) {
          logger.warn('心跳超时，关闭连接', { uid });
          this.connections.delete(toUidKey(uid));
          this.notifyDisconnect(uid);
          try {
            connectionInfo.ws.close(408, 'Heartbeat timeout');
          } catch {
            // 忽略关闭错误
          }
        }
      }
    }, this.heartbeatInterval);
    // 允许进程在无其他活动时退出（测试结束后不阻塞）
    (this.heartbeatTimer as NodeJS.Timeout).unref();
  }

  /** 停止心跳定时器（集成测试 teardown 使用，避免句柄泄漏） */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  isUserConnected(uid: Uid): boolean {
    const info = this.connections.get(toUidKey(uid));
    return !!(info && info.ws.readyState === WebSocket.OPEN);
  }
}

export const wsManager = new WSManager();
