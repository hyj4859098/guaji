#!/usr/bin/env node
/**
 * init-mongodb 验证脚本
 * 验证数据库集合和功能性道具是否正确初始化
 * 用法：node scripts/verify-init-mongodb.js
 * 可选环境变量：MONGODB_URI（默认 mongodb://localhost:27017）
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'turn-based-game';

const REQUIRED_COLLECTIONS = [
  'user', 'player', 'bag', 'equip_instance', 'user_equip', 'skill', 'player_skill',
  'monster', 'monster_drop', 'boss', 'boss_state', 'boss_drop', 'map', 'level_exp',
  'item', 'equip_base', 'item_effect', 'shop', 'config', 'auction', 'auction_record', 'counter'
];

const REQUIRED_CONFIG = ['functional_items', 'enhance_materials'];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  const results = [];

  function ok(name, detail = '') {
    results.push({ name, pass: true, detail });
    console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  }
  function fail(name, err) {
    results.push({ name, pass: false, detail: String(err) });
    console.log(`  ✗ ${name}: ${err}`);
  }

  console.log('\n=== init-mongodb 验证 ===\n');
  console.log(`数据库: ${MONGODB_URI}/${DB_NAME}\n`);

  try {
    await client.connect();
  } catch (e) {
    console.error('无法连接 MongoDB:', e.message);
    console.log('  提示：请确保 MongoDB 已启动');
    process.exit(1);
  }

  const db = client.db(DB_NAME);

  try {
    // 1. 检查集合
    console.log('1. 集合检查');
    const existing = await db.listCollections().toArray();
    const names = new Set(existing.map(c => c.name));

    for (const name of REQUIRED_COLLECTIONS) {
      if (names.has(name)) {
        ok(`集合 ${name}`, '存在');
      } else {
        fail(`集合 ${name}`, '不存在');
      }
    }

    // 2. 检查 config
    console.log('\n2. 配置检查');
    const configColl = db.collection('config');
    for (const name of REQUIRED_CONFIG) {
      const doc = await configColl.findOne({ name });
      if (doc && doc.value) {
        ok(`config.${name}`, '已配置');
      } else {
        fail(`config.${name}`, '未配置或为空');
      }
    }

    // 3. 检查功能性道具
    console.log('\n3. 功能性道具检查');
    const itemColl = db.collection('item');
    const effectColl = db.collection('item_effect');

    const funcCfg = await configColl.findOne({ name: 'functional_items' });
    if (!funcCfg || !funcCfg.value) {
      fail('functional_items', '无法读取');
    } else {
      let cfg;
      try {
        cfg = JSON.parse(funcCfg.value);
      } catch (e) {
        fail('functional_items', 'JSON 解析失败');
      }

      if (cfg) {
        const em = cfg.enhance_materials || {};
        const materialIds = [em.stone, em.anti_explode, em.lucky, em.blessing_oil].filter(Boolean);
        for (const id of materialIds) {
          const item = await itemColl.findOne({ id });
          if (item) ok(`强化材料 id=${id}`, item.name || '');
          else fail(`强化材料 id=${id}`, '不存在');
        }

        const expandBagId = cfg.expand_bag ?? 11;
        const expandBag = await itemColl.findOne({ id: expandBagId });
        if (expandBag) ok('扩容袋', `id=${expandBagId}`);
        else fail('扩容袋', `id=${expandBagId} 不存在`);

        const expandEffect = await effectColl.findOne({ item_id: expandBagId });
        if (expandEffect && expandEffect.effect_type === 'expand_bag') ok('扩容袋效果', '已配置');
        else fail('扩容袋效果', '未配置');

        const vipId = cfg.vip_card ?? 201;
        const vipItem = await itemColl.findOne({ id: vipId });
        if (vipItem) ok('VIP卡', `id=${vipId}`);
        else fail('VIP卡', `id=${vipId} 不存在`);

        const boostIds = cfg.boost_ids || [];
        const boostCount = boostIds.length;
        if (boostCount >= 12) ok('多倍卡', `${boostCount} 张`);
        else fail('多倍卡', `仅 ${boostCount} 张，应有 12 张`);

        const statIds = cfg.stat_fruit_ids || [];
        const statCount = statIds.length;
        if (statCount >= 6) ok('永久属性果实', `${statCount} 个`);
        else fail('永久属性果实', `仅 ${statCount} 个，应有 6 个`);
      }
    }

    // 4. 检查 counter
    console.log('\n4. 计数器检查');
    const counterColl = db.collection('counter');
    const itemCounter = await counterColl.findOne({ name: 'item' });
    if (itemCounter && typeof itemCounter.seq === 'number') {
      ok('item counter', `seq=${itemCounter.seq}`);
    } else {
      fail('item counter', '未初始化');
    }

    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    console.log(`\n=== 结果: ${passed}/${total} 通过 ===\n`);
    process.exitCode = passed === total ? 0 : 1;
  } catch (e) {
    console.error('验证过程出错:', e);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
