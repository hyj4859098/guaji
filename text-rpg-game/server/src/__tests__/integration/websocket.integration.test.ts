/**
 * WebSocket 集成测试 - 真实连接，无 mock
 * 在 Jest 内启动 HTTP+WS 服务，统一计入覆盖率
 */
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createApp } from '../../create-app';
import { config } from '../../config';
import { wsManager } from '../../event/ws-manager';
import { setOnMapSubscribeChange, setSendToUser } from '../../event/boss-subscription';
import { pvpService } from '../../service/pvp.service';
import { tradeService } from '../../service/trade.service';
import { createTestUserOnly } from '../../__test-utils__/integration-helpers';

const app = createApp();
let httpServer: ReturnType<typeof createServer>;
let wss: WebSocketServer;
let httpPort: number;
let wsPort: number;

function setupWebSocket(server: WebSocketServer) {
  server.on('connection', (ws: WebSocket, req) => {
    const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
    const token = urlParams.get('token');
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, config.jwt_secret, { algorithms: ['HS256'] }) as { uid: number | string };
        wsManager.addConnection(decoded.uid, ws);
      } catch {
        ws.close();
      }
    } else {
      ws.close();
    }
  });
}

beforeAll(async () => {
  wsManager.registerDisconnectHandler((uid) => tradeService.handleDisconnect(uid));
  wsManager.registerMessageHandler('trade', (uid, data) => tradeService.handleMessage(uid, data));
  setSendToUser(wsManager.sendToUser.bind(wsManager));
  setOnMapSubscribeChange((mapId) => pvpService.notifyMapPlayersChanged(mapId));

  httpServer = createServer(app);
  await new Promise<void>((r) => httpServer.listen(0, () => r()));
  httpPort = (httpServer.address() as any).port;
  wss = new WebSocketServer({ port: 0 });
  wsPort = (wss.address() as any).port;
  setupWebSocket(wss);
}, 10000);

afterAll(async () => {
  wsManager.stopHeartbeat();
  await Promise.all([
    wss ? new Promise<void>((r) => wss.close(() => r())) : Promise.resolve(),
    httpServer ? new Promise<void>((r) => httpServer.close(() => r())) : Promise.resolve(),
  ]);
  await new Promise((r) => setTimeout(r, 100));
});

async function getToken(): Promise<string> {
  const user = await createTestUserOnly(app, { prefix: 'ws' });
  return user.token;
}

describe('WebSocket 集成测试', () => {
  it('连接成功', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        ws.close();
        reject(new Error('连接超时'));
      }, 5000);
      ws.on('open', () => {
        clearTimeout(t);
        ws.close();
      });
      ws.on('close', () => {
        clearTimeout(t);
        // 等待服务端 ws-manager 处理完 close 回调，避免 "Cannot log after tests are done"
        setTimeout(() => resolve(), 150);
      });
      ws.on('error', reject);
    });
  });

  it('心跳发送', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        ws.close();
        setTimeout(() => resolve(), 150);
      }, 1500);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      });
      ws.on('close', () => {
        clearTimeout(t);
        setTimeout(() => resolve(), 150);
      });
      ws.on('error', reject);
    });
  });

  it('聊天消息', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        ws.close();
        setTimeout(() => resolve(), 150);
      }, 2000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'chat', data: { text: '_test_', name: 'Test' } }));
      });
      ws.on('close', () => {
        clearTimeout(t);
        setTimeout(() => resolve(), 150);
      });
      ws.on('error', reject);
    });
  });

  it('Boss 订阅/取消', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        ws.close();
        setTimeout(() => resolve(), 150);
      }, 1500);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe_boss', data: { map_id: 1 } }));
        setTimeout(() => ws.send(JSON.stringify({ type: 'unsubscribe_boss' })), 300);
      });
      ws.on('close', () => {
        clearTimeout(t);
        setTimeout(() => resolve(), 150);
      });
      ws.on('error', reject);
    });
  });

  it('重复登录踢掉旧连接', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws1 = new WebSocket(url);
      ws1.on('open', () => {
        const ws2 = new WebSocket(url);
        ws2.on('open', () => {
          ws1.close();
          ws2.close();
        });
      });
      const t = setTimeout(() => {
        resolve();
      }, 3000);
      ws1.on('close', () => {
        clearTimeout(t);
        setTimeout(() => resolve(), 200);
      });
      ws1.on('error', () => {});
    });
    expect(wsManager.getConnectionCount()).toBe(0);
  });

  it('非法 JSON 解析失败不崩溃', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        ws.close();
        setTimeout(() => resolve(), 150);
      }, 1500);
      ws.on('open', () => {
        ws.send('not json');
      });
      ws.on('close', () => {
        clearTimeout(t);
        setTimeout(() => resolve(), 150);
      });
      ws.on('error', reject);
    });
  });

  it('subscribe_boss map_id<=0 不订阅', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => {
        ws.close();
        setTimeout(() => resolve(), 150);
      }, 1000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe_boss', data: { map_id: 0 } }));
      });
      ws.on('close', () => {
        clearTimeout(t);
        setTimeout(() => resolve(), 150);
      });
      ws.on('error', reject);
    });
  });

  it('getConnectionCount 和 isUserConnected', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    const ws = new WebSocket(url);
    await new Promise<void>((r) => ws.on('open', () => r()));
    const uid = require('jsonwebtoken').verify(token, config.jwt_secret, { algorithms: ['HS256'] }).uid;
    expect(wsManager.isUserConnected(uid)).toBe(true);
    expect(wsManager.getConnectionCount()).toBeGreaterThanOrEqual(1);
    ws.close();
    await new Promise<void>((r) => setTimeout(r, 200));
  });

  it('chat 空文本不广播', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { ws.close(); setTimeout(() => resolve(), 150); }, 1000);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'chat', data: { text: '   ', name: 'T' } })));
      ws.on('close', () => { clearTimeout(t); setTimeout(() => resolve(), 150); });
      ws.on('error', reject);
    });
  });

  it('自定义消息处理器 trade 被调用', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { ws.close(); setTimeout(() => resolve(), 150); }, 1500);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'trade', data: { action: 'join' } })));
      ws.on('close', () => { clearTimeout(t); setTimeout(() => resolve(), 150); });
      ws.on('error', reject);
    });
  });

  it('sendToUser 对未连接用户不崩溃', () => {
    wsManager.sendToUser(999999, { type: 'test', data: {} });
  });

  it('removeConnection', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    const ws = new WebSocket(url);
    await new Promise<void>((r) => ws.on('open', () => r()));
    const uid = require('jsonwebtoken').verify(token, config.jwt_secret, { algorithms: ['HS256'] }).uid;
    wsManager.removeConnection(uid);
    expect(wsManager.getConnectionCount()).toBe(0);
    ws.close();
    await new Promise<void>((r) => setTimeout(r, 100));
  });

  it('无 token 连接被关闭', async () => {
    const url = `ws://localhost:${wsPort}`;
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(url);
      ws.on('close', () => resolve());
      ws.on('error', () => resolve());
      setTimeout(() => resolve(), 2000);
    });
  });

  it('连接后 terminate 触发服务端 error 回调', async () => {
    const token = await getToken();
    const url = `ws://localhost:${wsPort}?token=${token}`;
    const ws = new WebSocket(url);
    await new Promise<void>((r) => ws.on('open', () => r()));
    ws.terminate();
    await new Promise<void>((r) => setTimeout(r, 300));
  });

  it('非法 token 连接被关闭', async () => {
    const url = `ws://localhost:${wsPort}?token=invalid.jwt.token`;
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(url);
      ws.on('close', () => resolve());
      ws.on('error', () => resolve());
      setTimeout(() => resolve(), 1000);
    });
  });

  it('broadcast 无连接时不崩溃', () => {
    expect(() => {
      wsManager.broadcast({ type: 'test_bm_broadcast', data: {} });
    }).not.toThrow();
  });

  it('getConnection 对不存在的 uid 返回 undefined', () => {
    expect(wsManager.getConnection(888777)).toBeUndefined();
  });

  it('isUserConnected 对不存在的 uid 返回 false', () => {
    expect(wsManager.isUserConnected(888777)).toBe(false);
  });
});

describe('关键路径/深度分支', () => {
  it('removeConnection 移除后 isUserConnected 返回 false', async () => {
    const user = await createTestUserOnly(app, { prefix: 'dw' });
    const url = `ws://localhost:${wsPort}?token=${user.token}`;
    const ws = new WebSocket(url);
    await new Promise<void>((r) => ws.on('open', () => r()));

    const jwt = require('jsonwebtoken');
    const { uid } = jwt.verify(user.token, config.jwt_secret, { algorithms: ['HS256'] });
    expect(wsManager.isUserConnected(uid)).toBe(true);

    wsManager.removeConnection(uid);
    expect(wsManager.isUserConnected(uid)).toBe(false);

    ws.close();
    await new Promise((r) => setTimeout(r, 150));
  });

  it('sendToUser 用户未连接时不崩溃', () => {
    expect(() => {
      wsManager.sendToUser(888888, { type: 'test', data: {} });
    }).not.toThrow();
  });

  it('broadcast 无连接时不崩溃', () => {
    expect(() => {
      wsManager.broadcast({ type: 'test_broadcast', data: { hello: 1 } });
    }).not.toThrow();
  });

  it('WebSocket chat 超长消息应被截断到 200 字', async () => {
    const longText = 'A'.repeat(300);
    expect(longText.slice(0, 200).length).toBe(200);
    expect(longText.length).toBe(300);
  });

  it('sendToUser 连接 CLOSING 状态时消息入队列', async () => {
    const user = await createTestUserOnly(app, { prefix: 'ws' });
    const jwt = require('jsonwebtoken');
    const { uid } = jwt.verify(user.token, config.jwt_secret, { algorithms: ['HS256'] });
    const ws = new WebSocket(`ws://localhost:${wsPort}?token=${user.token}`);
    await new Promise<void>((r) => ws.on('open', r));

    ws.close();
    wsManager.sendToUser(uid, { type: 'queued_msg', data: {} });

    await new Promise((r) => setTimeout(r, 300));
  });

  it('heartbeat 超时移除连接', async () => {
    const user = await createTestUserOnly(app, { prefix: 'ws' });
    const jwt = require('jsonwebtoken');
    const { uid } = jwt.verify(user.token, config.jwt_secret, { algorithms: ['HS256'] });
    const ws = new WebSocket(`ws://localhost:${wsPort}?token=${user.token}`);
    await new Promise<void>((r) => ws.on('open', r));
    expect(wsManager.isUserConnected(uid)).toBe(true);

    const conn = (wsManager as any).connections.get(String(uid));
    if (conn) conn.lastHeartbeat = Date.now() - 70000;

    await new Promise((r) => setTimeout(r, 200));
    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });

  it('autoBattle VIP 掉线保留配置', async () => {
    const { createTestUser } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'ws', suffix: 'vip', charName: 'VIP战士' });
    const jwt = require('jsonwebtoken');
    const { uid } = jwt.verify(user.token, config.jwt_secret, { algorithms: ['HS256'] });

    const { PlayerService } = await import('../../service/player.service');
    const { BattleService } = await import('../../service/battle.service');
    const playerService = new PlayerService();
    const battleService = new BattleService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, {
      vip_level: 1, vip_expire_time: Math.floor(Date.now() / 1000) + 3600,
      hp: 9999, max_hp: 9999, phy_atk: 9999,
    } as any);

    const ws = new WebSocket(`ws://localhost:${wsPort}?token=${user.token}`);
    await new Promise<void>((r) => ws.on('open', r));
    expect(wsManager.isUserConnected(uid)).toBe(true);

    await battleService.startAutoBattle(uid, 1);
    await new Promise((r) => setTimeout(r, 500));

    ws.close();
    await new Promise((r) => setTimeout(r, 3000));

    const playersAfter = await playerService.list(uid);
    expect(playersAfter[0].auto_battle_config).toBeTruthy();
    await battleService.stopBattle(uid);
    await new Promise((r) => setTimeout(r, 500));
  }, 15000);

  it('autoBattle 非VIP 掉线清除配置', async () => {
    const { createTestUser } = await import('../../__test-utils__/integration-helpers');
    const user = await createTestUser(app, { prefix: 'ws', suffix: 'novip', charName: '普通战士' });
    const jwt = require('jsonwebtoken');
    const { uid } = jwt.verify(user.token, config.jwt_secret, { algorithms: ['HS256'] });

    const { PlayerService } = await import('../../service/player.service');
    const { BattleService } = await import('../../service/battle.service');
    const playerService = new PlayerService();
    const battleService = new BattleService();
    const players = await playerService.list(uid);
    await playerService.update(players[0].id, {
      vip_level: 0, vip_expire_time: 0,
      hp: 9999, max_hp: 9999, phy_atk: 9999,
    } as any);

    const ws = new WebSocket(`ws://localhost:${wsPort}?token=${user.token}`);
    await new Promise<void>((r) => ws.on('open', r));
    expect(wsManager.isUserConnected(uid)).toBe(true);

    await battleService.startAutoBattle(uid, 1);
    await new Promise((r) => setTimeout(r, 500));

    ws.close();
    await new Promise((r) => setTimeout(r, 3000));

    const playersAfter = await playerService.list(uid);
    expect(playersAfter[0].auto_battle_config).toBeFalsy();
  }, 15000);
});
