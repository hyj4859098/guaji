/**
 * API 响应时间基线测试
 *
 * 对核心 API 逐个测量 P50/P95/P99 响应时间。
 * 用法: node scripts/perf-baseline.js [baseUrl]
 * 默认: http://localhost:3000
 *
 * 退出码: 0 = 全部达标, 1 = 有接口超标
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const RUNS = 30;
const P99_THRESHOLD_MS = 500;

async function api(method, path, token, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, opts);
  const elapsed = performance.now() - start;
  const data = await res.json();
  return { elapsed, code: data.code };
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

async function setup() {
  const username = `perf${Date.now().toString(36)}`;
  const reg = await api('POST', '/api/user/register', null, { username, password: 'test123456' });
  if (reg.code !== 0) throw new Error(`注册失败: ${JSON.stringify(reg)}`);
  const login = await api('POST', '/api/user/login', null, { username, password: 'test123456' });
  const token = login.code === 0 ? (await (await fetch(`${BASE}/api/user/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'test123456' })
  })).json()).data.token : reg.code === 0 ? (await (await fetch(`${BASE}/api/user/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username + 'b', password: 'test123456' })
  })).json()).data?.token : null;

  const regRes = await (await fetch(`${BASE}/api/user/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `perf2${Date.now().toString(36)}`, password: 'test123456' })
  })).json();
  const tk = regRes.data?.token;
  if (tk) {
    await fetch(`${BASE}/api/player/add`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tk}` },
      body: JSON.stringify({ name: '性能测试角色' })
    });
  }
  return tk;
}

const ENDPOINTS = [
  { method: 'GET', path: '/api/player/list', name: '玩家列表', auth: true },
  { method: 'GET', path: '/api/bag/list', name: '背包列表', auth: true },
  { method: 'GET', path: '/api/equip/list', name: '装备列表', auth: true },
  { method: 'GET', path: '/api/shop/list?type=gold', name: '商店列表', auth: true },
  { method: 'GET', path: '/api/monster/list', name: '怪物列表', auth: false },
  { method: 'GET', path: '/api/map/list', name: '地图列表', auth: false },
  { method: 'GET', path: '/api/boss/list', name: 'Boss列表', auth: true },
  { method: 'GET', path: '/api/rank/list?type=gold', name: '排行榜', auth: true },
  { method: 'GET', path: '/api/skill/list', name: '技能列表', auth: true },
  { method: 'GET', path: '/api/auction/list', name: '拍卖列表', auth: true },
  { method: 'GET', path: '/api/boost/config', name: '多倍配置', auth: true },
  { method: 'GET', path: '/api/config/client', name: '客户端配置', auth: false },
  { method: 'POST', path: '/api/battle/start', name: '开始战斗', auth: true, body: { enemy_id: 1 } },
  { method: 'POST', path: '/api/shop/buy', name: '商店购买', auth: true, body: { shop_item_id: 1, count: 1 } },
];

async function main() {
  console.log(`\n===== API 响应时间基线 (${RUNS} 次/接口) =====\n`);
  console.log(`BASE_URL: ${BASE}\n`);

  let token;
  try {
    token = await setup();
  } catch (e) {
    console.error('Setup failed:', e.message);
    process.exit(1);
  }

  if (!token) {
    console.error('无法获取 token');
    process.exit(1);
  }

  const results = [];
  let allPass = true;

  for (const ep of ENDPOINTS) {
    const times = [];
    for (let i = 0; i < RUNS; i++) {
      try {
        const { elapsed } = await api(ep.method, ep.path, ep.auth ? token : null, ep.body);
        times.push(elapsed);
      } catch {
        times.push(9999);
      }
    }

    const p50 = percentile(times, 50);
    const p95 = percentile(times, 95);
    const p99 = percentile(times, 99);
    const pass = p99 < P99_THRESHOLD_MS;
    if (!pass) allPass = false;

    results.push({ name: ep.name, p50, p95, p99, pass });
  }

  console.log('| 接口 | P50 | P95 | P99 | 状态 |');
  console.log('|------|-----|-----|-----|------|');
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`| ${r.name.padEnd(10)} | ${r.p50.toFixed(0).padStart(4)}ms | ${r.p95.toFixed(0).padStart(4)}ms | ${r.p99.toFixed(0).padStart(4)}ms | ${status} |`);
  }

  const passCount = results.filter(r => r.pass).length;
  console.log(`\n结果: ${passCount}/${results.length} 接口 P99 < ${P99_THRESHOLD_MS}ms`);

  if (!allPass) {
    console.log('\n有接口超标，请检查性能。');
    process.exit(1);
  }

  console.log('\n全部达标。');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
