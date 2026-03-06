#!/usr/bin/env node
/**
 * 全量测试入口 - 统一 Jest 一套测试，真实覆盖率
 *
 * Jest 已整合：单元测试 + 集成测试（API、GM、WebSocket、安全）
 * 使用 MongoDB Memory Server，无需启动服务器
 *
 * 用法：
 *   node scripts/test-all.js           # Jest 全量（含覆盖率）
 *   node scripts/test-all.js --extra   # Jest + init 验证 + db 层（需 MongoDB）
 *   node scripts/test-all.js --ci      # 仅 Jest（CI 用）
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'server');
const ROOT = path.join(__dirname, '..');

function run(cmd, cwd, desc) {
  console.log(`\n>>> ${desc}\n`);
  const r = spawnSync(cmd, [], { cwd, stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) {
    console.error(`\n[失败] ${desc} (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

const extra = process.argv.includes('--extra');
const ciMode = process.argv.includes('--ci');

console.log('\n========== 全量测试（统一 Jest） ==========\n');

run('npm run test:coverage', SERVER, '1. Jest 单元+集成测试（含覆盖率）');

if (extra && !ciMode) {
  process.env.MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'turn-based-game-test';
  run('node init-mongodb.js', SERVER, '2. 初始化测试库');
  run('node ../scripts/create-test-admin.js', SERVER, '3. 创建测试管理员');
  run('node ../scripts/verify-init-mongodb.js', SERVER, '4. init-mongodb 验证');
  run('node ../scripts/test-db-layer.js', SERVER, '5. 数据库层验证');
}

console.log('\n========== 全量测试通过 ==========\n');
