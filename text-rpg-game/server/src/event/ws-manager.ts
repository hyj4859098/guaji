import { WebSocket } from 'ws';
import { Uid } from '../types/index';
import { logger } from '../utils/logger';
import { tradeService } from '../service/trade.service';
import { subscribeBoss, unsubscribeBoss } from './boss-subscription';

interface ConnectionInfo {
  ws: WebSocket;
  lastHeartbeat: number;
  messageQueue: any[];
}

/** 统一 uid 为字符串，避免 number/string 导致 Map 查找失败 */
function toKey(uid: Uid): string {
  return String(uid);
}

class WSManager {
  private connections = new Map<string, ConnectionInfo>();
  private maxConnections = 1000; // 最大连接数限制
  private heartbeatInterval = 30000; // 心跳间隔（毫秒）
  private heartbeatTimeout = 60000; // 心跳超时时间（毫秒）

  constructor() {
    // 启动心跳检测
    this.startHeartbeatCheck();
  }

  addConnection(uid: Uid, ws: WebSocket) {
    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      logger.warn('连接数达到上限', { maxConnections: this.maxConnections });
      ws.close(429, 'Too many connections');
      return;
    }

    const connectionInfo: ConnectionInfo = {
      ws,
      lastHeartbeat: Date.now(),
      messageQueue: []
    };

    const key = toKey(uid);
    this.connections.set(key, connectionInfo);
    logger.info('新的WebSocket连接', { uid, connections: this.connections.size });

    ws.on('close', () => {
      const cur = this.connections.get(key);
      if (cur && cur.ws === ws) {
        this.connections.delete(key);
        logger.info('WebSocket连接关闭', { uid, connections: this.connections.size });
        tradeService.handleDisconnect(uid);
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
        } else if (message.type === 'trade') {
          tradeService.handleMessage(uid, message.data);
        } else if (message.type === 'chat') {
          const text = String(message.data?.text || '').trim().slice(0, 200);
          if (text) {
            this.broadcast({
              type: 'chat',
              data: { uid: String(uid), name: message.data?.name || '???', text, time: Date.now() }
            });
          }
        } else if (message.type === 'subscribe_boss') {
          const mapId = Number(message.data?.map_id);
          if (mapId > 0) subscribeBoss(uid, mapId);
        } else if (message.type === 'unsubscribe_boss') {
          unsubscribeBoss(uid);
        }
      } catch (error) {
        logger.error('解析WebSocket消息失败', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    // 处理消息队列
    this.processMessageQueue(uid);
  }

  removeConnection(uid: Uid) {
    this.connections.delete(toKey(uid));
    logger.info('移除WebSocket连接', { uid, connections: this.connections.size });
  }

  getConnection(uid: Uid): WebSocket | undefined {
    const connectionInfo = this.connections.get(toKey(uid));
    return connectionInfo?.ws;
  }

  sendToUser(uid: Uid, message: any) {
    const key = toKey(uid);
    const connectionInfo = this.connections.get(key);
    if (connectionInfo) {
      if (connectionInfo.ws.readyState === WebSocket.OPEN) {
        try {
          connectionInfo.ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('发送消息失败', { uid, error: error instanceof Error ? error.message : String(error) });
          // 将消息加入队列，稍后重试
          connectionInfo.messageQueue.push(message);
        }
      } else {
        // 连接未就绪，将消息加入队列
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

  private processMessageQueue(uid: Uid) {
    const connectionInfo = this.connections.get(toKey(uid));
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
        setTimeout(() => process(), 100);
      }
    };

    process();
  }

  private startHeartbeatCheck() {
    setInterval(async () => {
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
            this.connections.delete(toKey(uid));
          }
        }

        // 检查心跳超时
        if (now - connectionInfo.lastHeartbeat > this.heartbeatTimeout) {
          logger.warn('心跳超时，关闭连接', { uid });
          try {
            connectionInfo.ws.close(408, 'Heartbeat timeout');
          } catch (error) {
            // 忽略关闭错误
          }
          this.connections.delete(toKey(uid));
        }
      }
    }, this.heartbeatInterval);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  isUserConnected(uid: Uid): boolean {
    const info = this.connections.get(toKey(uid));
    return !!(info && info.ws.readyState === WebSocket.OPEN);
  }
}

export const wsManager = new WSManager();
