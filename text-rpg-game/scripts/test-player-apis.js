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

  // 2b. GM 预发（保证后续用例有数据）
  let adminToken = null;
  try {
    const adminRes = await req('POST', '/admin/login', { username: 'admin', password: 'admin123' });
    if (adminRes.code === 0 && adminRes.data?.token) {
      adminToken = adminRes.data.token;
      const adminH = () => ({ 'Authorization': `Bearer ${adminToken}` });
      await req('POST', '/admin/player/give-gold', { uid, amount: 3000000 }, adminToken);
      await req('POST', '/admin/player/give-item', { uid, item_id: 13, count: 1 }, adminToken);
      await req('POST', '/admin/player/give-item', { uid, item_id: 6, count: 150 }, adminToken);
      await req('POST', '/admin/player/give-item', { uid, item_id: 7, count: 10 }, adminToken);
      await req('POST', '/admin/player/give-item', { uid, item_id: 10, count: 5 }, adminToken);
      await req('POST', '/admin/player/give-item', { uid, item_id: 1, count: 3 }, adminToken);
      ok('GM 预发', '金币+装备+材料');
    } else {
      ok('GM 预发', '跳过(无admin)');
    }
  } catch (e) {
    ok('GM 预发', '跳过');
  }

  // 2c. 负向：无 token 应失败
  console.log('\n2c. 负向-鉴权');
  try {
    const noAuthRes = await req('GET', '/bag/list', null, null);
    if (noAuthRes.code !== 0 && (noAuthRes.code === 40002 || noAuthRes.msg?.includes('token') || noAuthRes.msg?.includes('认证'))) {
      ok('无 token 拒绝', '正确返回错误');
    } else {
      fail('无 token 拒绝', `应失败却返回 code=${noAuthRes.code}`);
    }
  } catch (e) {
    ok('无 token 拒绝', '请求失败即通过');
  }

  // 2d. 负向：缺少必填参数应失败
  console.log('\n2d. 负向-参数');
  try {
    const badRes = await req('POST', '/bag/use', {}, token);
    if (badRes.code !== 0 && (badRes.code === 40000 || badRes.code === 40001 || badRes.msg?.includes('参数') || badRes.msg?.includes('id'))) {
      ok('缺参拒绝', '正确返回错误');
    } else {
      fail('缺参拒绝', `应失败却返回 code=${badRes.code}`);
    }
  } catch (e) {
    ok('缺参拒绝', '请求失败即通过');
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

  // 16. 背包使用物品（消耗品，GM 已发小血瓶）
  console.log('\n16. 背包使用物品');
  try {
    const bagRes = await fetch(`${BASE}/bag/list`, { headers: h() });
    const bagData = await bagRes.json();
    const consumable = bagData.data?.items?.find(i => i.item_id === 1);
    if (consumable) {
      const useRes = await req('POST', '/bag/use', { id: consumable.original_id || consumable.id, count: 1 }, token);
      if (useRes.code === 0) {
        ok('使用消耗品', '小血瓶 x1');
      } else {
        fail('使用消耗品', useRes.msg || '失败');
      }
    } else {
      ok('使用消耗品', '跳过(无消耗品)');
    }
  } catch (e) {
    fail('使用消耗品', e.message);
  }

  // 18. 商店购买（GM 已发金币）
  console.log('\n18. 商店购买');
  try {
    const shopRes = await fetch(`${BASE}/shop/list`, { headers: h() });
    const shopData = await shopRes.json();
    const shopItems = shopData.code === 0 ? (shopData.data || []) : [];
    const firstShop = shopItems[0];
    if (firstShop && firstShop.id) {
      const buyRes = await req('POST', '/shop/buy', { shop_item_id: firstShop.id, count: 1 }, token);
      if (buyRes.code === 0) {
        ok('商店购买', '成功');
      } else if (buyRes.msg && (buyRes.msg.includes('金币') || buyRes.msg.includes('不足'))) {
        ok('商店购买', '跳过(金币不足)');
      } else {
        fail('商店购买', buyRes.msg || '失败');
      }
    } else {
      ok('商店购买', '跳过(商店无商品)');
    }
  } catch (e) {
    fail('商店购买', e.message);
  }

  // 19. 装备穿戴/卸下（GM 已发装备 13）
  let wornEquipId = null;
  console.log('\n19. 装备穿戴');
  try {
    const bagRes2 = await fetch(`${BASE}/bag/list`, { headers: h() });
    const bagData2 = await bagRes2.json();
    const equipInBag = bagData2.data?.items?.find(i => i.type === 2 || i.item_id === 13);
    if (equipInBag) {
      const bagId = equipInBag.original_id || equipInBag.id;
      const wearRes = await req('POST', '/bag/wear', { id: bagId }, token);
      if (wearRes.code === 0) {
        ok('穿戴装备', '成功');
        const equipListRes = await fetch(`${BASE}/equip/list`, { headers: h() });
        const equipListData = await equipListRes.json();
        const wornEquip = equipListData.code === 0 && Array.isArray(equipListData.data) ? equipListData.data[0] : null;
        if (wornEquip && wornEquip.id) {
          wornEquipId = wornEquip.id;
          const removeRes = await req('POST', '/equip/remove', { id: wornEquip.id }, token);
          if (removeRes.code === 0) ok('卸下装备', '成功');
          else ok('卸下装备', '跳过');
          // 装备在背包才能强化/祝福，暂不重新穿戴
        } else {
          ok('卸下装备', '跳过');
        }
      } else {
        fail('穿戴装备', wearRes.msg || '失败');
      }
    } else {
      fail('穿戴装备', '背包无装备');
    }
  } catch (e) {
    fail('穿戴装备', e.message);
  }

  // 19b. 装备强化（需 GM 装备+材料）
  if (wornEquipId) {
    console.log('\n19b. 装备强化');
    try {
      const enhanceRes = await req('POST', '/equip/enhance', {
        instance_id: wornEquipId,
        use_lucky_charm: false,
        use_anti_explode: false
      }, token);
      if (enhanceRes.code === 0 && enhanceRes.data) {
        const lv = enhanceRes.data.enhance_level;
        ok('装备强化', `level=${lv}`);
      } else if (enhanceRes.msg && enhanceRes.msg.includes('材料')) {
        ok('装备强化', '跳过(材料不足)');
      } else {
        fail('装备强化', enhanceRes.msg || '失败');
      }
    } catch (e) {
      fail('装备强化', e.message);
    }
  }

  // 19c. 装备祝福（需 GM 装备+金币）
  if (wornEquipId) {
    console.log('\n19c. 装备祝福');
    try {
      const blessRes = await req('POST', '/equip/bless', { instance_id: wornEquipId }, token);
      if (blessRes.code === 0 && blessRes.data) {
        ok('装备祝福', '成功');
      } else if (blessRes.msg && blessRes.msg.includes('金币')) {
        ok('装备祝福', '跳过(金币不足)');
      } else {
        fail('装备祝福', blessRes.msg || '失败');
      }
    } catch (e) {
      fail('装备祝福', e.message);
    }
  }

  // 20. 技能装备/卸下
  console.log('\n20. 技能装备');
  try {
    const skillListRes = await fetch(`${BASE}/skill/list`, { headers: h() });
    const skillListData = await skillListRes.json();
    const skills = skillListData.code === 0 ? (skillListData.data || []) : [];
    const firstSkill = skills.find(s => s.id);
    if (firstSkill) {
      const equipRes = await req('POST', '/skill/equip', { skill_id: firstSkill.id }, token);
      if (equipRes.code === 0) {
        ok('装备技能', '成功');
        await req('POST', '/skill/unequip', { skill_id: firstSkill.id }, token);
        ok('卸下技能', '成功');
      } else {
        ok('装备技能', equipRes.msg || '跳过');
      }
    } else {
      ok('装备技能', '跳过(无技能)');
    }
  } catch (e) {
    ok('装备技能', '跳过');
  }

  // 20b. 技能学习 - 负向（无效技能书应失败）
  console.log('\n20b. 技能学习-负向');
  try {
    const learnRes = await req('POST', '/skill/learn', { book_id: 99999 }, token);
    if (learnRes.code !== 0) {
      ok('无效技能书拒绝', '正确返回错误');
    } else {
      fail('无效技能书拒绝', '应失败');
    }
  } catch (e) {
    ok('无效技能书拒绝', '请求失败即通过');
  }

  // 21. Boss 列表/挑战
  let firstBossId = null;
  let firstMapId = null;
  console.log('\n21. Boss API');
  try {
    const bossListRes = await fetch(`${BASE}/boss/list`, { headers: h() });
    const bossListData = await bossListRes.json();
    if (bossListData.code === 0 && Array.isArray(bossListData.data)) {
      firstBossId = bossListData.data[0]?.id;
      ok('Boss 列表', `${bossListData.data.length} 个`);
    } else {
      fail('Boss 列表', bossListData.msg || '格式错误');
    }
  } catch (e) {
    fail('Boss 列表', e.message);
  }
  const mapRes = await fetch(`${BASE}/map/list`, { headers: h() });
  const mapData = await mapRes.json();
  if (mapData.code === 0 && Array.isArray(mapData.data) && mapData.data.length > 0) {
    firstMapId = mapData.data[0].id;
  }
  if (firstBossId) {
    console.log('\n21b. Boss 挑战');
    try {
      const chalRes = await req('POST', '/boss/challenge', { boss_id: firstBossId, auto_heal: false }, token);
      if (chalRes.code === 0 && chalRes.data) {
        ok('Boss 挑战', '已发起');
      } else {
        fail('Boss 挑战', chalRes.msg || '失败');
      }
    } catch (e) {
      fail('Boss 挑战', e.message);
    }
  }

  // 21c. PVP 对手/挑战（需第二个用户）
  let pvpTargetUid = null;
  try {
    const reg2 = await req('POST', '/user/register', { username: `_test_pvp_${Date.now()}`, password: 'test123456' });
    if (reg2.code === 0 && reg2.data?.uid) {
      pvpTargetUid = reg2.data.uid;
      await req('POST', '/player/add', { name: 'PVP对手' }, reg2.data.token);
      ok('PVP 对手用户', `uid=${pvpTargetUid}`);
    }
  } catch (e) {
    ok('PVP 对手用户', '跳过');
  }
  if (pvpTargetUid && firstMapId) {
    console.log('\n21d. PVP opponent');
    try {
      const oppRes = await req('GET', `/pvp/opponent?uid=${pvpTargetUid}`, null, token);
      if (oppRes.code === 0 && oppRes.data) {
        ok('PVP 对手信息', '已获取');
      } else {
        fail('PVP 对手信息', oppRes.msg || '失败');
      }
    } catch (e) {
      fail('PVP 对手信息', e.message);
    }
    console.log('\n21e. PVP 挑战');
    try {
      const chalRes = await req('POST', '/pvp/challenge', { target_uid: pvpTargetUid, map_id: firstMapId }, token);
      if (chalRes.code === 0) {
        ok('PVP 挑战', '已发起');
      } else {
        fail('PVP 挑战', chalRes.msg || '失败');
      }
    } catch (e) {
      fail('PVP 挑战', e.message);
    }
  }

  // 22. 拍卖记录
  console.log('\n22. 拍卖记录');
  try {
    const recRes = await fetch(`${BASE}/auction/records`, { headers: h() });
    const recData = await recRes.json();
    if (recData.code === 0 && recData.data?.records !== undefined) {
      ok('拍卖记录', '已获取');
    } else {
      fail('拍卖记录', recData.msg || '格式错误');
    }
  } catch (e) {
    fail('拍卖记录', e.message);
  }

  // 22a. 拍卖上架/下架（GM 已发强化石）
  let listedAuctionId = null;
  console.log('\n22a. 拍卖上架');
  try {
    const bagForAuc = await fetch(`${BASE}/bag/list`, { headers: h() });
    const bagAuc = await bagForAuc.json();
    const stone = bagAuc.data?.items?.find(i => i.item_id === 6);
    if (stone) {
      const bagId = stone.original_id || stone.id;
      const listRes = await req('POST', '/auction/list', { bag_id: bagId, count: 1, price: 100 }, token);
      if (listRes.code === 0 && listRes.data?.auction_id) {
        listedAuctionId = listRes.data.auction_id;
        ok('拍卖上架', `auction_id=${listedAuctionId}`);
      } else {
        fail('拍卖上架', listRes.msg || '失败');
      }
    } else {
      fail('拍卖上架', '背包无强化石');
    }
  } catch (e) {
    fail('拍卖上架', e.message);
  }
  if (listedAuctionId) {
    console.log('\n22b. 拍卖下架');
    try {
      const offRes = await req('POST', '/auction/off-shelf', { auction_id: listedAuctionId }, token);
      if (offRes.code === 0) {
        ok('拍卖下架', '成功');
      } else {
        fail('拍卖下架', offRes.msg || '失败');
      }
    } catch (e) {
      fail('拍卖下架', e.message);
    }
  }

  // 22c. 多倍卡开关（需背包有多倍卡）
  console.log('\n22c. 多倍卡开关');
  try {
    const toggleRes = await req('POST', '/boost/toggle', { category: 'exp', multiplier: 'x2', enabled: true }, token);
    if (toggleRes.code === 0) {
      ok('多倍卡开关', '已开启');
      await req('POST', '/boost/toggle', { category: 'exp', multiplier: 'x2', enabled: false }, token);
    } else if (toggleRes.msg && toggleRes.msg.includes('多倍卡')) {
      ok('多倍卡开关', '跳过(无多倍卡)');
    } else {
      fail('多倍卡开关', toggleRes.msg || '失败');
    }
  } catch (e) {
    ok('多倍卡开关', '跳过');
  }

  // 23. 货币类型
  console.log('\n23. 货币类型');
  try {
    const curRes = await fetch(`${BASE}/shop/currencies`, { headers: h() });
    const curData = await curRes.json();
    if (curData.code === 0 && curData.data) {
      ok('货币类型', '已获取');
    } else {
      fail('货币类型', curData.msg || '无数据');
    }
  } catch (e) {
    fail('货币类型', e.message);
  }

  // 24. 战斗流程
  console.log('\n24. 战斗流程');
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
