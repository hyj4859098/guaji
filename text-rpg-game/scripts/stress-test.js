/**
 * 并发压力测试
 *
 * 模拟多并发用户执行核心流程：注册→战斗→商店→拍卖。
 * 用法: node scripts/stress-test.js [baseUrl] [concurrency] [durationSec]
 * 默认: http://localhost:3000, 50 并发, 30 秒
 *
 * 输出: TPS、错误率、P50/P95/P99 延迟
 * 退出码: 0 = 错误率 < 1%, 1 = 错误率 >= 1%
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.argv[3]) || 50;
const DURATION_SEC = parseInt(process.argv[4]) || 30;

const stats = { requests: 0, errors: 0, latencies: [] };

async function api(method, path, token, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    const elapsed = performance.now() - start;
    stats.requests++;
    stats.latencies.push(elapsed);
    if (data.code !== 0 && data.code !== undefined) stats.errors++;
    return data;
  } catch {
    stats.requests++;
    stats.errors++;
    stats.latencies.push(performance.now() - start);
    return { code: -1 };
  }
}

async function createUser(id) {
  const username = `st${id}${Date.now().toString(36).slice(-4)}`;
  const reg = await api('POST', '/api/user/register', null, { username, password: 'test123456' });
  if (reg.code !== 0 || !reg.data?.token) return null;
  const token = reg.data.token;
  await api('POST', '/api/player/add', token, { name: `压测${id}` });
  return token;
}

async function userLoop(id, endTime) {
  const token = await createUser(id);
  if (!token) return;

  while (Date.now() < endTime) {
    await api('GET', '/api/player/list', token);
    await api('GET', '/api/bag/list', token);
    await api('POST', '/api/battle/start', token, { enemy_id: 1 });
    await api('GET', '/api/shop/list?type=gold', token);
    await api('POST', '/api/shop/buy', token, { shop_item_id: 1, count: 1 });
    await api('GET', '/api/equip/list', token);
    await api('GET', '/api/auction/list', token);
    await api('GET', '/api/rank/list?type=gold', token);
  }
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log(`\n===== 并发压力测试 =====`);
  console.log(`URL: ${BASE}`);
  console.log(`并发: ${CONCURRENCY}, 持续: ${DURATION_SEC}s\n`);

  const endTime = Date.now() + DURATION_SEC * 1000;
  const startTime = Date.now();

  const promises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    promises.push(userLoop(i, endTime));
  }

  await Promise.allSettled(promises);

  const elapsed = (Date.now() - startTime) / 1000;
  const tps = (stats.requests / elapsed).toFixed(1);
  const errorRate = stats.requests > 0 ? (stats.errors / stats.requests * 100).toFixed(2) : '0.00';

  const p50 = stats.latencies.length ? percentile(stats.latencies, 50).toFixed(0) : 'N/A';
  const p95 = stats.latencies.length ? percentile(stats.latencies, 95).toFixed(0) : 'N/A';
  const p99 = stats.latencies.length ? percentile(stats.latencies, 99).toFixed(0) : 'N/A';

  console.log('===== 结果 =====');
  console.log(`总请求: ${stats.requests}`);
  console.log(`总错误: ${stats.errors}`);
  console.log(`错误率: ${errorRate}%`);
  console.log(`TPS:    ${tps}`);
  console.log(`P50:    ${p50}ms`);
  console.log(`P95:    ${p95}ms`);
  console.log(`P99:    ${p99}ms`);
  console.log(`耗时:   ${elapsed.toFixed(1)}s`);

  if (parseFloat(errorRate) >= 1) {
    console.log('\n错误率 >= 1%，未达标。');
    process.exit(1);
  }
  console.log('\n达标: 错误率 < 1%');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
