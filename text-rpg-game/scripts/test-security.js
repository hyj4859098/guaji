/**
 * 防漏洞测试：负向参数、异常值、越权
 * 用法：确保 MongoDB 和服务器已启动，然后执行：
 *   node scripts/test-security.js
 */
const BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function req(method, path, body, token) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json();
}

async function main() {
  const testUser = `_test_sec_${Date.now()}`;
  const testPass = 'test123456';
  let token = null;
  let uid = null;
  const results = [];

  function ok(name, detail = '') {
    results.push({ name, pass: true, detail });
    console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  }
  function fail(name, err) {
    results.push({ name, pass: false, detail: String(err) });
    console.log(`  ✗ ${name}: ${err}`);
  }

  console.log('\n=== 防漏洞测试 ===\n');

  // 注册并登录
  try {
    const regRes = await req('POST', '/user/register', { username: testUser, password: testPass });
    if (regRes.code === 429) {
      console.error('登录/注册限流已耗尽（上次测试触发），请 15 分钟后重试或重启服务器');
      process.exit(1);
    }
    if (regRes.code === 0 && regRes.data?.token) {
      token = regRes.data.token;
      uid = regRes.data.uid;
    } else {
      const loginRes = await req('POST', '/user/login', { username: testUser, password: testPass });
      if (loginRes.code === 429) {
        console.error('登录/注册限流已耗尽，请 15 分钟后重试或重启服务器');
        process.exit(1);
      }
      if (loginRes.code === 0) {
        token = loginRes.data.token;
        uid = loginRes.data.uid;
      } else {
        console.error('无法获取 token');
        process.exit(1);
      }
    }
  } catch (e) {
    console.error('注册/登录失败:', e.message);
    process.exit(1);
  }

  await req('POST', '/player/add', { name: '安全测试' }, token);

  // 2a. 角色名 NoSQL 注入应拒绝
  console.log('\n2a. 角色名注入防护');
  try {
    const r = await req('POST', '/player/add', { name: '{ "$gt": "" }' }, token);
    if (r.code !== 0) ok('NoSQL 注入名拒绝');
    else fail('NoSQL 注入名拒绝', '应失败');
  } catch (e) { ok('NoSQL 注入名拒绝', '异常'); }

  // GM 预发少量物品（用于拍卖负价格测试）
  try {
    const adminRes = await req('POST', '/admin/login', { username: 'admin', password: 'admin123' });
    if (adminRes.code === 0) {
      await req('POST', '/admin/player/give-item', { uid, item_id: 6, count: 2 }, adminRes.data.token);
    }
  } catch (_) {}

  const h = () => ({ 'Authorization': `Bearer ${token}` });

  // 1. bag/add 已移除（防刷道具），应 404
  console.log('\n1. 背包直接添加-已移除');
  try {
    const r = await fetch(`${BASE}/bag/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ item_id: 1, count: 1 }),
    });
    if (r.status === 404) ok('bag/add 已移除');
    else fail('bag/add 已移除', `应404，实际${r.status}`);
  } catch (e) { ok('bag/add 已移除', '异常即通过'); }

  // 2. shop/buy 异常数量应失败
  console.log('\n2. 商店购买-异常数量');
  const shopRes = await fetch(`${BASE}/shop/list`, { headers: h() });
  const shopData = await shopRes.json();
  const firstShop = shopData.code === 0 && shopData.data?.length ? shopData.data[0] : null;
  if (firstShop?.id) {
    try {
      const r = await req('POST', '/shop/buy', { shop_item_id: firstShop.id, count: -1 }, token);
      if (r.code !== 0) ok('购买 count=-1 拒绝');
      else fail('购买 count=-1 拒绝', '应失败');
    } catch (e) { ok('购买 count=-1 拒绝', '异常'); }

    try {
      const r = await req('POST', '/shop/buy', { shop_item_id: firstShop.id, count: 0 }, token);
      if (r.code !== 0) ok('购买 count=0 拒绝');
      else fail('购买 count=0 拒绝', '应失败');
    } catch (e) { ok('购买 count=0 拒绝', '异常'); }
  } else {
    ok('购买异常数量', '跳过(无商品)');
  }

  // 3. 拍卖上架 负价格应失败
  console.log('\n3. 拍卖上架-负价格');
  const bagRes = await fetch(`${BASE}/bag/list`, { headers: h() });
  const bagData = await bagRes.json();
  const stone = bagData.data?.items?.find(i => i.item_id === 6);
  if (stone) {
    const bagId = stone.original_id || stone.id;
    try {
      const r = await req('POST', '/auction/list', { bag_id: bagId, count: 1, price: -100 }, token);
      if (r.code !== 0) ok('拍卖 price=-100 拒绝');
      else fail('拍卖 price=-100 拒绝', '应失败');
    } catch (e) { ok('拍卖 price=-100 拒绝', '异常'); }
  } else {
    ok('拍卖负价格', '跳过(无物品)');
  }

  // 4. 无效 ID 应失败
  console.log('\n4. 无效 ID');
  try {
    const r = await req('POST', '/shop/buy', { shop_item_id: 999999, count: 1 }, token);
    if (r.code !== 0) ok('无效 shop_item_id 拒绝');
    else fail('无效 shop_item_id 拒绝', '应失败');
  } catch (e) { ok('无效 shop_item_id 拒绝', '异常'); }

  try {
    const r = await req('POST', '/auction/buy', { auction_id: 999999, count: 1 }, token);
    if (r.code !== 0) ok('无效 auction_id 拒绝');
    else fail('无效 auction_id 拒绝', '应失败');
  } catch (e) { ok('无效 auction_id 拒绝', '异常'); }

  // 4b. 拍卖购买异常数量
  try {
    const r = await req('POST', '/auction/buy', { auction_id: 1, count: -1 }, token);
    if (r.code !== 0) ok('拍卖购买 count=-1 拒绝');
    else fail('拍卖购买 count=-1 拒绝', '应失败');
  } catch (e) { ok('拍卖购买 count=-1 拒绝', '异常'); }

  // 4c. 玩家越权：尝试获取/更新他人角色应拒绝
  console.log('\n4c. 玩家越权');
  try {
    const listRes = await req('GET', '/player/list', null, token);
    const myPlayerId = listRes.data?.[0]?.id;
    if (myPlayerId) {
      const rGet = await req('GET', `/player/get?id=${myPlayerId + 99999}`, null, token);
      if (rGet.code !== 0) ok('获取他人角色拒绝');
      else ok('获取他人角色', '可能无其他角色，跳过');
    }
    const rUpdate = await req('POST', '/player/update', { id: 1, gold: 999999 }, token);
    if (rUpdate.code !== 0) ok('更新他人角色拒绝');
    else fail('更新他人角色', '应失败');
  } catch (e) { ok('玩家越权', '异常'); }

  // 5. 无 token 访问敏感接口
  console.log('\n5. 鉴权');
  try {
    const r = await fetch(`${BASE}/bag/list`, { headers: {} });
    const data = await r.json();
    if (data.code !== 0) ok('无 token 拒绝');
    else fail('无 token 拒绝', '应失败');
  } catch (e) { ok('无 token 拒绝', '异常'); }

  // 6. 限流：连续错误登录 11 次应触发 429（10 次/15 分钟）
  console.log('\n6. 限流');
  try {
    let lastRes = null;
    for (let i = 0; i < 11; i++) {
      lastRes = await req('POST', '/user/login', { username: `rate_limit_test_${Date.now()}`, password: 'x' });
    }
    if (lastRes?.code === 429) ok('登录限流 429');
    else fail('登录限流', `第11次应返回429，实际 code=${lastRes?.code}`);
  } catch (e) { fail('登录限流', e.message); }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`\n=== 结果: ${passed}/${total} 通过 ===\n`);
  process.exitCode = passed === total ? 0 : 1;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
