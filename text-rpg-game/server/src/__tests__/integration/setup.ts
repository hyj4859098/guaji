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

async function seedTestData(): Promise<void> {
  const { getDB } = await import('../../config/db');
  const db = getDB();
  const now = Math.floor(Date.now() / 1000);
  const upsert = async (coll: string, filter: Record<string, unknown>, doc: Record<string, unknown>) => {
    await db.collection(coll).updateOne(filter, { $setOnInsert: { ...doc, create_time: now, update_time: now } }, { upsert: true });
  };
  const ensureCounter = async (name: string, min: number) => {
    await db.collection('counter').updateOne({ name }, { $max: { seq: min } }, { upsert: true });
  };

  // 地图
  await upsert('map', { id: 1 }, { id: 1, name: '新手村' });
  await upsert('map', { id: 2 }, { id: 2, name: 'E2E平局测试图' });
  await ensureCounter('map', 2);

  // 怪物
  await upsert('monster', { id: 1 }, { id: 1, name: '史莱姆', level: 1, hp: 30, mp: 10, phy_atk: 5, phy_def: 2, mag_atk: 0, mag_def: 0, skill1: '', skill2: '', hit_rate: 80, dodge_rate: 5, crit_rate: 5, exp: 10, gold: 50, reputation: 0, map_id: 1 });
  await upsert('monster', { id: 2 }, { id: 2, name: 'E2E平局怪', level: 1, hp: 10, mp: 0, phy_atk: 100, phy_def: 0, mag_atk: 0, mag_def: 0, hit_rate: 100, dodge_rate: 0, crit_rate: 0, exp: 0, gold: 0, reputation: 0, map_id: 2 });
  await ensureCounter('monster', 2);

  // Boss
  await upsert('boss', { id: 1 }, { id: 1, name: '测试Boss', level: 1, hp: 100, mp: 20, phy_atk: 10, phy_def: 5, mag_atk: 0, mag_def: 0, hit_rate: 85, dodge_rate: 5, crit_rate: 5, exp: 50, gold: 20, reputation: 5, map_id: 1 });
  await ensureCounter('boss', 1);

  // 技能书 + 技能
  await upsert('item', { id: 14 }, { id: 14, name: '技能书·火球术', type: 4, pos: 0, description: '学习火球术' });
  await upsert('skill', { id: 1 }, { id: 1, name: '火球术', type: 1, damage: 20, mp_cost: 5, book_id: 14, cost: 0, probability: 100 });
  await ensureCounter('skill', 1);
  await upsert('item_effect', { item_id: 14 }, { item_id: 14, effect_type: 'learn_skill' });

  // 商店 (price: 0 for testing)
  const shopItems = [
    { id: 1, item_id: 1, category: 'consumable', sort_order: 1 },
    { id: 2, item_id: 13, category: 'equipment', sort_order: 3 },
    { id: 3, item_id: 6, category: 'material', sort_order: 4 },
    { id: 4, item_id: 10, category: 'material', sort_order: 5 },
    { id: 5, item_id: 14, category: 'tool', sort_order: 2 },
  ];
  for (const entry of shopItems) {
    await upsert('shop', { id: entry.id }, { id: entry.id, shop_type: 'gold', item_id: entry.item_id, price: 0, category: entry.category, sort_order: entry.sort_order, enabled: true });
  }
  await upsert('shop', { id: 6 }, { id: 6, shop_type: 'reputation', item_id: 1, price: 5, category: 'consumable', sort_order: 1, enabled: true });
  await upsert('shop', { id: 7 }, { id: 7, shop_type: 'points', item_id: 2, price: 10, category: 'consumable', sort_order: 1, enabled: true });
  await ensureCounter('shop', 7);
}

beforeAll(async () => {
  const { connect } = await import('../../config/db');
  await connect();

  const env = { ...process.env, MONGODB_URI: uri, MONGODB_DATABASE: database };

  const initPath = path.join(__dirname, '../../../init-mongodb.js');
  const r = spawnSync('node', [initPath], { env, cwd: path.dirname(initPath), encoding: 'utf-8' });
  if (r.status !== 0) {
    console.error('[integration] init-mongodb failed:', r.stderr || r.stdout);
    throw new Error('init-mongodb failed');
  }

  const createAdminPath = path.join(__dirname, '../../../../scripts/create-test-admin.js');
  const r2 = spawnSync('node', [createAdminPath], { env, cwd: path.join(__dirname, '../../../../'), encoding: 'utf-8' });
  if (r2.status !== 0) {
    console.error('[integration] create-test-admin failed:', r2.stderr || r2.stdout);
    throw new Error('create-test-admin failed');
  }

  await seedTestData();
}, 30000);

afterAll(async () => {
  const { wsManager } = await import('../../event/ws-manager');
  wsManager.stopHeartbeat();
  const { close } = await import('../../config/db');
  await close();
});
