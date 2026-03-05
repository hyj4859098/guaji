/**
 * WebSocket 连接与消息测试
 * 前置：MongoDB + 服务器已启动
 * 用法：node scripts/test-websocket.js
 * 可选：API_BASE, WS_URL（默认 ws://localhost:3001）
 */
const WebSocket = require('ws');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';

async function getToken() {
  const user = `_test_ws_${Date.now()}`;
  const pass = 'test123456';
  let res = await fetch(`${API_BASE}/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  let data = await res.json();
  if (data.code === 0 && data.data?.token) return data.data.token;
  res = await fetch(`${API_BASE}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  data = await res.json();
  if (data.code === 0 && data.data?.token) return data.data.token;
  throw new Error('无法获取 token');
}

function ok(name, detail = '') {
  console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  return true;
}
function fail(name, err) {
  console.log(`  ✗ ${name}: ${err}`);
  return false;
}

async function main() {
  const results = [];
  console.log('\n=== WebSocket 测试 ===\n');

  let token;
  try {
    token = await getToken();
    ok('获取 Token');
  } catch (e) {
    fail('获取 Token', e.message);
    console.log('  提示：请确保服务器已启动');
    process.exit(1);
  }

  const url = `${WS_URL}?token=${token}`;

  // 1. 连接
  console.log('\n1. 连接测试');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => {
      ws.close();
      reject(new Error('连接超时'));
    }, 5000);
    ws.on('open', () => {
      clearTimeout(t);
      results.push(ok('WebSocket 连接'));
      ws.close();
      resolve();
    });
    ws.on('error', (e) => reject(e));
  });

  // 2. 心跳（发送后连接保持不断开即通过；服务端每 30 秒主动发心跳，此处仅验证发送不报错）
  console.log('\n2. 心跳测试');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => {
      ws.close();
      resolve();
    }, 1500);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
      results.push(ok('心跳发送'));
    });
    ws.on('close', () => {
      clearTimeout(t);
      resolve();
    });
    ws.on('error', reject);
  });

  // 3. 聊天广播（发送后需能收到自己的消息或至少不报错）
  console.log('\n3. 聊天消息测试');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => {
      ws.close();
      resolve();
    }, 2000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'chat', data: { text: '_test_', name: 'Test' } }));
    });
    ws.on('message', () => {});
    ws.on('close', () => {
      clearTimeout(t);
      results.push(ok('聊天发送'));
      resolve();
    });
    ws.on('error', reject);
  });

  // 4. Boss 订阅
  console.log('\n4. Boss 订阅测试');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => {
      ws.close();
      resolve();
    }, 1500);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe_boss', data: { map_id: 1 } }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'unsubscribe_boss' }));
      }, 300);
    });
    ws.on('close', () => {
      clearTimeout(t);
      results.push(ok('Boss 订阅/取消'));
      resolve();
    });
    ws.on('error', reject);
  });

  console.log('\n=== WebSocket 测试完成 ===\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
