#!/usr/bin/env node
/**
 * 全量测试入口
 * 按顺序执行：单元测试 → 数据库验证 → GM API → 玩家 API → WebSocket
 * 前置：MongoDB 已启动；玩家/GM/WS 测试需服务器已启动
 *
 * 用法：
 *   node scripts/test-all.js
 *   node scripts/test-all.js --skip-api   # 跳过需服务器的测试
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

function run(cmd, cwd, desc) {
  console.log(`\n>>> ${desc}\n`);
  const r = spawnSync(cmd, [], { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n[失败] ${desc} (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

const skipApi = process.argv.includes('--skip-api');

console.log('\n========== 全量测试 ==========\n');

// 1. 单元测试
run('npm run test', SERVER, '1. Jest 单元测试');

// 2. 数据库验证
run('node ../scripts/verify-init-mongodb.js', SERVER, '2. init-mongodb 验证');

if (skipApi) {
  console.log('\n[跳过] API/WebSocket 测试 (--skip-api)\n');
  process.exit(0);
}

// 3. GM API
run('node scripts/test-gm-apis.js', ROOT, '3. GM API 测试');

// 4. 玩家 API
run('node scripts/test-player-apis.js', ROOT, '4. 玩家 API 测试');

// 5. WebSocket（需从 server 目录运行以使用 ws 包）
run('node ../scripts/test-websocket.js', SERVER, '5. WebSocket 测试');

console.log('\n========== 全量测试通过 ==========\n');
