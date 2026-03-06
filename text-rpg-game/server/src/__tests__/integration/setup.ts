/**
 * 真实集成测试 - 每个 worker 的 setup
 * 必须在任何导入 config/db 的模块之前设置 env，故在顶层同步执行
 */
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

const URI_FILE = path.join(__dirname, '.mongo-uri.json');

const raw = fs.readFileSync(URI_FILE, 'utf-8');
const { uri, database } = JSON.parse(raw);
process.env.MONGODB_URI = uri;
process.env.MONGODB_DATABASE = database;

beforeAll(async () => {
  const { connect } = await import('../../config/db');
  await connect();

  const initPath = path.join(__dirname, '../../../init-mongodb.js');
  const r = spawnSync('node', [initPath], {
    env: { ...process.env, MONGODB_URI: uri, MONGODB_DATABASE: database },
    cwd: path.dirname(initPath),
    encoding: 'utf-8',
  });
  if (r.status !== 0) {
    console.error('[integration] init-mongodb failed:', r.stderr || r.stdout);
    throw new Error('init-mongodb failed');
  }

  const createAdminPath = path.join(__dirname, '../../../../scripts/create-test-admin.js');
  const r2 = spawnSync('node', [createAdminPath], {
    env: { ...process.env, MONGODB_URI: uri, MONGODB_DATABASE: database },
    cwd: path.join(__dirname, '../../../../'),
    encoding: 'utf-8',
  });
  if (r2.status !== 0) {
    console.error('[integration] create-test-admin failed:', r2.stderr || r2.stdout);
    throw new Error('create-test-admin failed');
  }
}, 30000);

afterAll(async () => {
  const { wsManager } = await import('../../event/ws-manager');
  wsManager.stopHeartbeat();
  const { close } = await import('../../config/db');
  await close();
});
