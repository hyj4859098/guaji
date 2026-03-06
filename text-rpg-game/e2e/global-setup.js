/**
 * E2E 全局前置：初始化测试库 + 创建测试管理员
 * 确保 turn-based-game-test 有完整数据再跑用例
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, '../server');
const ROOT = path.join(__dirname, '..');
const env = { ...process.env, MONGODB_DATABASE: 'turn-based-game-test' };

module.exports = async function globalSetup() {
  console.log('[E2E globalSetup] 初始化测试库...');
  const r1 = spawnSync('node', ['init-mongodb.js'], { cwd: SERVER, env, stdio: 'inherit' });
  if (r1.status !== 0) {
    throw new Error('init-mongodb 失败');
  }
  const r2 = spawnSync('node', ['../scripts/create-test-admin.js'], { cwd: SERVER, env, stdio: 'inherit' });
  if (r2.status !== 0) {
    throw new Error('create-test-admin 失败');
  }
  console.log('[E2E globalSetup] 完成');
};
