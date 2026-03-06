/**
 * 集成测试共享辅助函数
 *
 * 消除 20+ 集成测试文件中的重复注册/登录/角色创建逻辑。
 * 所有集成测试应引用此模块，而非自行拼装注册流程。
 */
import type { Express } from 'express';
import request from 'supertest';
import { BagService } from '../service/bag.service';
import { PlayerService } from '../service/player.service';
const TEST_PASSWORD = 'test123456';

function uniqueName(prefix: string, suffix?: string): string {
  const ts = String(Date.now()).slice(-6);
  const rnd = Math.random().toString(36).slice(2, 6);
  const sfx = suffix ? suffix.slice(0, 8) : '';
  const name = `${prefix}${sfx}${ts}${rnd}`;
  return name.length > 32 ? name.slice(0, 32) : name;
}

export interface TestUser {
  uid: number;
  token: string;
  username: string;
}

/**
 * 注册用户 + 创建角色，返回 { uid, token, username }。
 * 适用于大部分集成测试。
 */
export async function createTestUser(
  app: Express,
  opts?: { prefix?: string; suffix?: string; charName?: string }
): Promise<TestUser> {
  const prefix = opts?.prefix ?? 'tu';
  const username = uniqueName(prefix, opts?.suffix);
  const charName = opts?.charName ?? `Test${prefix}`;

  const reg = await request(app)
    .post('/api/user/register')
    .send({ username, password: TEST_PASSWORD });
  if (reg.body.code !== 0) {
    throw new Error(`注册失败: ${reg.body.msg} (username=${username})`);
  }

  const { uid, token } = reg.body.data;

  await request(app)
    .post('/api/player/add')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: charName });

  return { uid, token, username };
}

/**
 * 只注册用户（不创建角色），返回 { uid, token, username }。
 * 适用于 WebSocket 或纯认证测试。
 */
export async function createTestUserOnly(
  app: Express,
  opts?: { prefix?: string; suffix?: string }
): Promise<TestUser> {
  const prefix = opts?.prefix ?? 'to';
  const username = uniqueName(prefix, opts?.suffix);

  const reg = await request(app)
    .post('/api/user/register')
    .send({ username, password: TEST_PASSWORD });
  if (reg.body.code !== 0) {
    throw new Error(`注册失败: ${reg.body.msg} (username=${username})`);
  }

  return { uid: reg.body.data.uid, token: reg.body.data.token, username };
}

/**
 * 管理员登录，返回 token。
 */
export async function adminLogin(app: Express): Promise<string> {
  const res = await request(app)
    .post('/api/admin/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(200);
  if (!res.body.data?.token) {
    throw new Error(`管理员登录失败: ${res.body.msg}`);
  }
  return res.body.data.token;
}

/**
 * 给玩家添加物品（直接调 service，跳过 API）。
 */
export async function giveItem(uid: number, itemId: number, count: number): Promise<void> {
  const bagService = new BagService();
  await bagService.addItem(uid, itemId, Math.min(count, 9999));
}

/**
 * 给玩家添加金币（直接调 service）。
 */
export async function giveGold(uid: number, amount: number): Promise<void> {
  const playerService = new PlayerService();
  await playerService.addGold(uid, amount);
}

export { TEST_PASSWORD };
