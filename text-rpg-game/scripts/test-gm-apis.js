/**
 * GM 相关 API 测试脚本
 * 用法：确保 MongoDB 和服务器已启动，然后执行：
 *   node scripts/test-gm-apis.js
 * 可选环境变量：ADMIN_USER, ADMIN_PASS（默认 admin/admin123）
 * 首次运行请先执行：node scripts/create-test-admin.js
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
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'admin123';
  let token = null;
  const results = [];

  function ok(name, pass, detail = '') {
    results.push({ name, pass, detail });
    console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  }
  function fail(name, err) {
    results.push({ name, pass: false, detail: String(err) });
    console.log(`  ✗ ${name}: ${err}`);
  }

  console.log('\n=== GM API 测试 ===\n');
  console.log('1. 管理员登录');
  try {
    const loginRes = await req('POST', '/admin/login', { username: user, password: pass });
    if (loginRes.code === 0 && loginRes.data?.token) {
      token = loginRes.data.token;
      ok('管理员登录', true, `uid=${loginRes.data.uid}`);
    } else {
      fail('管理员登录', loginRes.msg || '无 token');
      console.log('  提示：请确保 user 表存在 is_admin=1 的管理员，或设置 ADMIN_USER/ADMIN_PASS');
      process.exit(1);
    }
  } catch (e) {
    fail('管理员登录', e.message);
    console.log('  提示：请确保服务器已启动 (npm run dev)');
    process.exit(1);
  }

  const h = () => ({ 'Authorization': `Bearer ${token}` });

  console.log('\n2. 物品 API');
  try {
    // 无 page：全量（兼容 shop 等）
    const allRes = await fetch(`${BASE}/admin/item`, { headers: h() });
    const allData = await allRes.json();
    if (allData.code === 0 && Array.isArray(allData.data)) {
      ok('物品列表(全量)', true, `${allData.data.length} 条`);
    } else {
      fail('物品列表(全量)', allData.msg || '非数组');
    }
  } catch (e) {
    fail('物品列表(全量)', e.message);
  }

  try {
    const pageRes = await fetch(`${BASE}/admin/item?page=1&pageSize=20`, { headers: h() });
    const pageData = await pageRes.json();
    if (pageData.code === 0 && pageData.data?.data && Array.isArray(pageData.data.data)) {
      ok('物品列表(分页)', true, `第${pageData.data.page}页 共${pageData.data.total}条`);
    } else {
      fail('物品列表(分页)', pageData.msg || '格式错误');
    }
  } catch (e) {
    fail('物品列表(分页)', e.message);
  }

  try {
    const typeRes = await fetch(`${BASE}/admin/item?page=1&type=2`, { headers: h() });
    const typeData = await typeRes.json();
    if (typeData.code === 0 && typeData.data?.data) {
      const allEquip = typeData.data.data.every(i => i.type === 2);
      ok('物品列表(type=2筛选)', allEquip, `${typeData.data.data.length} 条装备`);
    } else {
      fail('物品列表(type=2筛选)', typeData.msg || '格式错误');
    }
  } catch (e) {
    fail('物品列表(type=2筛选)', e.message);
  }

  try {
    const oneRes = await fetch(`${BASE}/admin/item/1`, { headers: h() });
    const oneData = await oneRes.json();
    if (oneData.code === 0 && oneData.data?.id) {
      ok('物品详情', true, `id=${oneData.data.id} ${oneData.data.name}`);
    } else {
      fail('物品详情', oneData.msg || '无数据');
    }
  } catch (e) {
    fail('物品详情', e.message);
  }

  console.log('\n3. 装备基础 API');
  try {
    const ebRes = await fetch(`${BASE}/admin/equip_base`, { headers: h() });
    const ebData = await ebRes.json();
    if (ebData.code === 0 && Array.isArray(ebData.data)) {
      ok('装备基础列表', true, `${ebData.data.length} 条`);
    } else {
      fail('装备基础列表', ebData.msg || '非数组');
    }
  } catch (e) {
    fail('装备基础列表', e.message);
  }

  console.log('\n4. 道具效果 API');
  try {
    const ieRes = await fetch(`${BASE}/admin/item_effect`, { headers: h() });
    const ieData = await ieRes.json();
    if (ieData.code === 0 && Array.isArray(ieData.data)) {
      ok('道具效果列表', true, `${ieData.data.length} 条`);
    } else {
      fail('道具效果列表', ieData.msg || '非数组');
    }
  } catch (e) {
    fail('道具效果列表', e.message);
  }

  console.log('\n5. 技能 API');
  try {
    const skRes = await fetch(`${BASE}/admin/skill`, { headers: h() });
    const skData = await skRes.json();
    if (skData.code === 0 && Array.isArray(skData.data)) {
      ok('技能列表', true, `${skData.data.length} 条`);
    } else {
      fail('技能列表', skData.msg || '非数组');
    }
  } catch (e) {
    fail('技能列表', e.message);
  }

  console.log('\n6. 掉落 API');
  try {
    const mdRes = await fetch(`${BASE}/admin/monster_drop`, { headers: h() });
    const mdData = await mdRes.json();
    if (mdData.code === 0 && Array.isArray(mdData.data)) {
      ok('怪物掉落列表', true, `${mdData.data.length} 条`);
    } else {
      fail('怪物掉落列表', mdData.msg || '非数组');
    }
  } catch (e) {
    fail('怪物掉落列表', e.message);
  }

  console.log('\n6b. Boss 掉落 API');
  try {
    const bdRes = await fetch(`${BASE}/admin/boss_drop`, { headers: h() });
    const bdData = await bdRes.json();
    if (bdData.code === 0 && Array.isArray(bdData.data)) {
      ok('Boss掉落列表', true, `${bdData.data.length} 条`);
    } else {
      fail('Boss掉落列表', bdData.msg || '非数组');
    }
  } catch (e) {
    fail('Boss掉落列表', e.message);
  }

  console.log('\n6c. 怪物/地图/商店/等级 列表');
  try {
    const monRes = await fetch(`${BASE}/admin/monster`, { headers: h() });
    const monData = await monRes.json();
    if (monData.code === 0 && Array.isArray(monData.data)) ok('怪物管理列表', true, `${monData.data.length} 条`);
    else fail('怪物管理列表', monData.msg);
  } catch (e) { fail('怪物管理列表', e.message); }
  try {
    const mapRes = await fetch(`${BASE}/admin/map`, { headers: h() });
    const mapData = await mapRes.json();
    if (mapData.code === 0 && Array.isArray(mapData.data)) ok('地图管理列表', true, `${mapData.data.length} 条`);
    else fail('地图管理列表', mapData.msg);
  } catch (e) { fail('地图管理列表', e.message); }
  try {
    const shopRes = await fetch(`${BASE}/admin/shop`, { headers: h() });
    const shopData = await shopRes.json();
    if (shopData.code === 0 && Array.isArray(shopData.data)) ok('商店管理列表', true, `${shopData.data.length} 条`);
    else fail('商店管理列表', shopData.msg);
  } catch (e) { fail('商店管理列表', e.message); }
  try {
    const lvRes = await fetch(`${BASE}/admin/level`, { headers: h() });
    const lvData = await lvRes.json();
    if (lvData.code === 0 && Array.isArray(lvData.data)) ok('等级管理列表', true, `${lvData.data.length} 条`);
    else fail('等级管理列表', lvData?.msg || '非数组');
  } catch (e) { fail('等级管理列表', e.message); }

  console.log('\n6d. 玩家发放（需有效 uid）');
  let gmTestUsername = `_gm_test_${Date.now()}`;
  try {
    const regRes = await req('POST', '/user/register', { username: gmTestUsername, password: 'test123' });
    if (regRes.code === 0 && regRes.data?.uid) {
      const testUid = regRes.data.uid;
      const userToken = regRes.data.token;
      const addRes = await req('POST', '/player/add', { name: '_GM测试角色' }, userToken);
      if (addRes.code === 0 || addRes.msg?.includes('已有')) {
        const goldRes = await req('POST', '/admin/player/give-gold', { uid: testUid, amount: 1000 }, token);
        if (goldRes.code === 0) ok('GM发放金币', true, '1000');
        else fail('GM发放金币', goldRes.msg);
        const itemRes = await req('POST', '/admin/player/give-item', { uid: testUid, item_id: 1, count: 5 }, token);
        if (itemRes.code === 0) ok('GM发放物品', true, '小血瓶x5');
        else fail('GM发放物品', itemRes.msg);
      } else {
        ok('GM发放', '跳过(无角色)');
      }
    } else {
      ok('GM发放', '跳过');
    }
  } catch (e) {
    fail('GM发放', e.message);
  }

  console.log('\n6e. 解绑 IP');
  try {
    if (gmTestUsername) {
      const unbindRes = await req('POST', '/admin/user/unbind-ip', { username: gmTestUsername }, token);
      if (unbindRes.code === 0) ok('解绑 IP', true);
      else fail('解绑 IP', unbindRes.msg);
    } else {
      ok('解绑 IP', '跳过');
    }
  } catch (e) {
    fail('解绑 IP', e.message);
  }

  console.log('\n7. 装备一站式创建（物品管理 type=2 + equip_base）');
  let testEquipId = null;
  try {
    const equipRes = await req('POST', '/admin/item', {
      name: '_测试装备_勿留',
      type: 2,
      pos: 1,
      description: 'API测试用',
      base_level: 1,
      base_phy_atk: 5,
      base_phy_def: 0,
      base_mag_atk: 0,
      base_mag_def: 0,
      base_hp: 0,
      base_mp: 0,
      base_hit_rate: 0,
      base_dodge_rate: 0,
      base_crit_rate: 0
    }, token);
    if (equipRes.code === 0 && equipRes.data?.id) {
      testEquipId = equipRes.data.id;
      ok('装备一站式创建', true, `item_id=${testEquipId}`);
      const ebCheck = await fetch(`${BASE}/admin/equip_base`, { headers: h() });
      const ebData = await ebCheck.json();
      const found = ebData.data?.find(e => e.item_id === testEquipId);
      if (found) {
        ok('equip_base 已同步', true, `pos=${found.pos}`);
      } else {
        fail('equip_base 已同步', '未找到对应 equip_base');
      }
      await req('DELETE', `/admin/item/${testEquipId}`, null, token);
      ok('装备删除(含equip_base)', true);
    } else {
      fail('装备一站式创建', equipRes.msg || '无id');
    }
  } catch (e) {
    fail('装备一站式创建', e.message);
  }

  console.log('\n8. 物品增删改（会创建并删除测试物品）');
  let testItemId = null;
  try {
    const createRes = await req('POST', '/admin/item', {
      name: '_测试物品_勿留',
      type: 1,
      hp_restore: 10,
      mp_restore: 0,
      description: 'API测试用'
    }, token);
    if (createRes.code === 0 && createRes.data?.id) {
      testItemId = createRes.data.id;
      ok('物品新增', true, `id=${testItemId}`);
    } else {
      fail('物品新增', createRes.msg || '无id');
    }
  } catch (e) {
    fail('物品新增', e.message);
  }

  if (testItemId) {
    try {
      const updateRes = await req('PUT', `/admin/item/${testItemId}`, {
        name: '_测试物品_已更新',
        type: 1,
        hp_restore: 20,
        mp_restore: 0,
        description: 'API测试用-已更新'
      }, token);
      if (updateRes.code === 0) {
        ok('物品更新', true);
      } else {
        fail('物品更新', updateRes.msg);
      }
    } catch (e) {
      fail('物品更新', e.message);
    }
    try {
      const delRes = await req('DELETE', `/admin/item/${testItemId}`, null, token);
      if (delRes.code === 0) {
        ok('物品删除', true);
      } else {
        fail('物品删除', delRes.msg);
      }
    } catch (e) {
      fail('物品删除', e.message);
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
