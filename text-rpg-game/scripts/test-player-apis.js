/**
 * 玩家 API 集成测试脚本
 * 用法：确保 MongoDB 和服务器已启动，然后执行：
 *   node scripts/test-player-apis.js
 * 可选环境变量：
 *   API_BASE - API 地址（默认 http://localhost:3000/api）
 *   TEST_USER - 测试用户名（默认自动注册 _test_player_xxx）
 *   TEST_PASS - 测试密码（默认 test123456）
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
  const testUser = process.env.TEST_USER || `_test_player_${Date.now()}`;
  const testPass = process.env.TEST_PASS || 'test123456';
  let token = null;
  let uid = null;
  let playerId = null;
  const results = [];

  function ok(name, detail = '') {
    results.push({ name, pass: true, detail });
    console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  }
  function fail(name, err) {
    results.push({ name, pass: false, detail: String(err) });
    console.log(`  ✗ ${name}: ${err}`);
  }

  console.log('\n=== 玩家 API 集成测试 ===\n');

  // 1. 注册
  console.log('1. 用户注册');
  try {
    const regRes = await req('POST', '/user/register', { username: testUser, password: testPass });
    if (regRes.code === 0 && regRes.data?.token) {
      token = regRes.data.token;
      uid = regRes.data.uid;
      ok('用户注册', `uid=${uid}`);
    } else if (regRes.msg && regRes.msg.includes('已存在')) {
      // 用户名已存在，尝试登录
      const loginRes = await req('POST', '/user/login', { username: testUser, password: testPass });
      if (loginRes.code === 0 && loginRes.data?.token) {
        token = loginRes.data.token;
        uid = loginRes.data.uid;
        ok('用户登录（已存在）', `uid=${uid}`);
      } else {
        fail('用户登录', loginRes.msg || '无 token');
        process.exit(1);
      }
    } else {
      fail('用户注册', regRes.msg || '无 token');
      process.exit(1);
    }
  } catch (e) {
    fail('用户注册', e.message);
    console.log('  提示：请确保服务器已启动 (npm run dev)');
    process.exit(1);
  }

  const h = () => ({ 'Authorization': `Bearer ${token}` });

  // 2. 创建角色
  console.log('\n2. 创建角色');
  try {
    const addRes = await req('POST', '/player/add', { name: '测试角色' }, token);
    if (addRes.code === 0 && addRes.data?.id) {
      playerId = addRes.data.id;
      ok('创建角色', `player_id=${playerId}`);
    } else {
      // 可能已有角色
      const listRes = await req('GET', '/player/list', null, token);
      if (listRes.code === 0 && Array.isArray(listRes.data) && listRes.data.length > 0) {
        playerId = listRes.data[0].id;
        ok('已有角色', `player_id=${playerId}`);
      } else {
        fail('创建角色', addRes.msg || '无 id');
      }
    }
  } catch (e) {
    fail('创建角色', e.message);
  }

  // 3. 背包
  console.log('\n3. 背包 API');
  try {
    const bagRes = await fetch(`${BASE}/bag/list`, { headers: h() });
    const bagData = await bagRes.json();
    if (bagData.code === 0 && bagData.data?.items && Array.isArray(bagData.data.items)) {
      ok('背包列表', `${bagData.data.items.length} 件`);
    } else {
      fail('背包列表', bagData.msg || '格式错误');
    }
  } catch (e) {
    fail('背包列表', e.message);
  }

  // 4. 装备
  console.log('\n4. 装备 API');
  try {
    const equipRes = await fetch(`${BASE}/equip/list`, { headers: h() });
    const equipData = await equipRes.json();
    if (equipData.code === 0 && Array.isArray(equipData.data)) {
      ok('装备列表', `${equipData.data.length} 件`);
    } else {
      fail('装备列表', equipData.msg || '格式错误');
    }
  } catch (e) {
    fail('装备列表', e.message);
  }

  // 5. 技能
  console.log('\n5. 技能 API');
  try {
    const skillRes = await fetch(`${BASE}/skill/list`, { headers: h() });
    const skillData = await skillRes.json();
    if (skillData.code === 0 && Array.isArray(skillData.data)) {
      ok('技能列表', `${skillData.data.length} 个`);
    } else {
      fail('技能列表', skillData.msg || '格式错误');
    }
  } catch (e) {
    fail('技能列表', e.message);
  }

  // 6. 地图
  console.log('\n6. 地图 API');
  try {
    const mapRes = await fetch(`${BASE}/map/list`, { headers: h() });
    const mapData = await mapRes.json();
    if (mapData.code === 0 && Array.isArray(mapData.data)) {
      ok('地图列表', `${mapData.data.length} 张`);
    } else {
      fail('地图列表', mapData.msg || '格式错误');
    }
  } catch (e) {
    fail('地图列表', e.message);
  }

  // 7. 怪物
  console.log('\n7. 怪物 API');
  try {
    const monRes = await fetch(`${BASE}/monster/list`, { headers: h() });
    const monData = await monRes.json();
    if (monData.code === 0 && Array.isArray(monData.data)) {
      ok('怪物列表', `${monData.data.length} 种`);
    } else {
      fail('怪物列表', monData.msg || '格式错误');
    }
  } catch (e) {
    fail('怪物列表', e.message);
  }

  // 8. 商店
  console.log('\n8. 商店 API');
  try {
    const shopRes = await fetch(`${BASE}/shop/list`, { headers: h() });
    const shopData = await shopRes.json();
    if (shopData.code === 0 && Array.isArray(shopData.data)) {
      ok('商店列表', `${shopData.data.length} 件`);
    } else {
      fail('商店列表', shopData.msg || '格式错误');
    }
  } catch (e) {
    fail('商店列表', e.message);
  }

  // 9. 强化配置
  console.log('\n9. 配置 API');
  try {
    const cfgRes = await fetch(`${BASE}/config/enhance_materials`, { headers: h() });
    const cfgData = await cfgRes.json();
    if (cfgData.code === 0 && cfgData.data) {
      ok('强化材料配置', '已获取');
    } else {
      fail('强化材料配置', cfgData.msg || '无数据');
    }
  } catch (e) {
    fail('强化材料配置', e.message);
  }

  // 10. 玩家列表
  console.log('\n10. 玩家 API');
  try {
    const plRes = await fetch(`${BASE}/player/list`, { headers: h() });
    const plData = await plRes.json();
    if (plData.code === 0 && Array.isArray(plData.data)) {
      ok('玩家列表', `${plData.data.length} 个角色`);
    } else {
      fail('玩家列表', plData.msg || '格式错误');
    }
  } catch (e) {
    fail('玩家列表', e.message);
  }

  // 11. 多倍卡配置
  console.log('\n11. 多倍卡 API');
  try {
    const boostRes = await fetch(`${BASE}/boost/config`, { headers: h() });
    const boostData = await boostRes.json();
    if (boostData.code === 0 && boostData.data !== undefined) {
      ok('多倍卡配置', '已获取');
    } else {
      fail('多倍卡配置', boostData.msg || '格式错误');
    }
  } catch (e) {
    fail('多倍卡配置', e.message);
  }

  // 12. 等级经验
  console.log('\n12. 等级经验 API');
  try {
    const lvRes = await fetch(`${BASE}/level_exp/get?level=1`, { headers: h() });
    const lvData = await lvRes.json();
    if (lvData.code === 0 && lvData.data !== undefined) {
      ok('等级经验', '已获取');
    } else {
      fail('等级经验', lvData.msg || '格式错误');
    }
  } catch (e) {
    fail('等级经验', e.message);
  }

  // 13. 排行榜
  console.log('\n13. 排行榜 API');
  try {
    const rankRes = await fetch(`${BASE}/rank/list`, { headers: h() });
    const rankData = await rankRes.json();
    if (rankData.code === 0 && rankData.data && Array.isArray(rankData.data.items)) {
      ok('排行榜', `${rankData.data.items.length} 条`);
    } else {
      fail('排行榜', rankData.msg || '格式错误');
    }
  } catch (e) {
    fail('排行榜', e.message);
  }

  // 14. 战斗状态
  console.log('\n14. 战斗 API');
  try {
    const battleRes = await fetch(`${BASE}/battle/status`, { headers: h() });
    const battleData = await battleRes.json();
    if (battleData.code === 0 && battleData.data !== undefined) {
      ok('战斗状态', '已获取');
    } else {
      fail('战斗状态', battleData.msg || '格式错误');
    }
  } catch (e) {
    fail('战斗状态', e.message);
  }

  // 15. 拍卖行
  console.log('\n15. 拍卖行 API');
  try {
    const aucRes = await fetch(`${BASE}/auction/list?page=1&pageSize=10`, { headers: h() });
    const aucData = await aucRes.json();
    if (aucData.code === 0 && aucData.data) {
      ok('拍卖行列表', '已获取');
    } else {
      fail('拍卖行列表', aucData.msg || '格式错误');
    }
  } catch (e) {
    fail('拍卖行列表', e.message);
  }

  // 16. 背包添加物品
  console.log('\n16. 背包添加');
  try {
    const addRes = await req('POST', '/bag/add', { item_id: 6, count: 1 }, token);
    if (addRes.code === 0) {
      ok('背包添加物品', '强化石 x1');
    } else {
      fail('背包添加物品', addRes.msg || '失败');
    }
  } catch (e) {
    fail('背包添加物品', e.message);
  }

  // 17. 战斗流程
  console.log('\n17. 战斗流程');
  let monsterId = null;
  try {
    const monRes = await fetch(`${BASE}/monster/list`, { headers: h() });
    const monData = await monRes.json();
    if (monData.code === 0 && Array.isArray(monData.data) && monData.data.length > 0) {
      monsterId = monData.data[0].id;
      ok('获取怪物ID', `id=${monsterId}`);
    }
  } catch (e) {
    fail('获取怪物ID', e.message);
  }

  if (monsterId) {
    try {
      const startRes = await req('POST', '/battle/start', { enemy_id: monsterId }, token);
      if (startRes.code === 0 && startRes.data) {
        ok('单场战斗', `结果=${startRes.data.result}`);
      } else {
        fail('单场战斗', startRes.msg || '失败');
      }
    } catch (e) {
      fail('单场战斗', e.message);
    }

    try {
      const autoRes = await req('POST', '/battle/auto', { enemy_id: monsterId }, token);
      if (autoRes.code === 0) {
        ok('开启自动战斗', '已启动');
        await new Promise(r => setTimeout(r, 300));
        const stopRes = await req('POST', '/battle/stop', {}, token);
        if (stopRes.code === 0) ok('停止自动战斗', '已停止');
        else fail('停止自动战斗', stopRes.msg);
      } else {
        fail('开启自动战斗', autoRes.msg || '失败');
      }
    } catch (e) {
      fail('自动战斗', e.message);
    }
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`\n=== 结果: ${passed}/${total} 通过 ===\n`);
  process.exitCode = passed === total ? 0 : 1;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
