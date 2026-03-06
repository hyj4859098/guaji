/**
 * E2E / 集成测试专用种子数据
 * 仅在测试环境执行，包含测试用地图、怪物、商店、Boss 等。
 * 执行方式：node seed-e2e.js  (需设置 MONGODB_DATABASE=turn-based-game-test)
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'turn-based-game-test';

async function nextId(counterColl, name) {
  const r = await counterColl.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return (r && typeof r.seq === 'number') ? r.seq : 1;
}

async function seedE2E() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`[seed-e2e] Connected to ${MONGODB_DATABASE}`);

    const db = client.db(MONGODB_DATABASE);
    const now = Math.floor(Date.now() / 1000);

    const itemColl = db.collection('item');
    const effectColl = db.collection('item_effect');
    const counterColl = db.collection('counter');
    const mapColl = db.collection('map');
    const monsterColl = db.collection('monster');
    const levelExpColl = db.collection('level_exp');
    const shopColl = db.collection('shop');
    const skillColl = db.collection('skill');
    const bossColl = db.collection('boss');
    const configColl = db.collection('config');

    const funcCfgDoc = await configColl.findOne({ name: 'functional_items' });
    let funcCfg;
    try { funcCfg = JSON.parse(funcCfgDoc?.value || '{}'); } catch { funcCfg = {}; }
    const em = funcCfg.enhance_materials || { stone: 6, lucky: 8, anti_explode: 7, blessing_oil: 10 };

    // -- 测试武器 --
    const TEST_WEAPON_ID = 13;
    const testWeapon = { id: TEST_WEAPON_ID, name: '测试木剑', type: 2, pos: 1, description: '测试用武器' };
    if (!(await itemColl.findOne({ id: TEST_WEAPON_ID }))) {
      await itemColl.insertOne({ ...testWeapon, create_time: now, update_time: now });
      const ebColl = db.collection('equip_base');
      if (!(await ebColl.findOne({ item_id: TEST_WEAPON_ID }))) {
        const ebId = await nextId(counterColl, 'equip_base');
        await ebColl.insertOne({ id: ebId, item_id: TEST_WEAPON_ID, pos: 1, base_level: 1, base_phy_atk: 10, base_phy_def: 0, base_mag_atk: 0, base_mag_def: 0, base_hp: 0, base_mp: 0, base_hit_rate: 90, base_dodge_rate: 0, base_crit_rate: 10, create_time: now, update_time: now });
      }
      console.log('[seed-e2e] Inserted test weapon (id=13)');
    }

    // -- 地图 --
    if (!(await mapColl.findOne({ id: 1 }))) {
      await mapColl.insertOne({ id: 1, name: '新手村', create_time: now, update_time: now });
      await counterColl.updateOne({ name: 'map' }, { $max: { seq: 1 } }, { upsert: true });
      console.log('[seed-e2e] Inserted map: 新手村');
    }

    if (!(await mapColl.findOne({ id: 2 }))) {
      await mapColl.insertOne({ id: 2, name: 'E2E平局测试图', create_time: now, update_time: now });
      await counterColl.updateOne({ name: 'map' }, { $max: { seq: 2 } }, { upsert: true });
    }

    // -- 等级经验 --
    if (!(await levelExpColl.findOne({ level: 1 }))) {
      await levelExpColl.insertOne({ id: 1, level: 1, exp: 100, create_time: now, update_time: now });
      await levelExpColl.insertOne({ id: 2, level: 2, exp: 200, create_time: now, update_time: now });
      await counterColl.updateOne({ name: 'level_exp' }, { $max: { seq: 2 } }, { upsert: true });
      console.log('[seed-e2e] Inserted level_exp: 1, 2');
    }

    // -- 怪物 --
    const testMonster = {
      id: 1, name: '史莱姆', level: 1, hp: 30, mp: 10,
      phy_atk: 5, phy_def: 2, mag_atk: 0, mag_def: 0,
      skill1: '', skill2: '', hit_rate: 80, dodge_rate: 5, crit_rate: 5,
      exp: 10, gold: 50, reputation: 0, map_id: 1,
      create_time: now, update_time: now
    };
    if (!(await monsterColl.findOne({ id: 1 }))) {
      await monsterColl.insertOne(testMonster);
      await counterColl.updateOne({ name: 'monster' }, { $max: { seq: 1 } }, { upsert: true });
      console.log('[seed-e2e] Inserted monster: 史莱姆');
    } else {
      await monsterColl.updateOne({ id: 1 }, { $set: { gold: 50, update_time: now } });
    }

    const moved = await monsterColl.updateMany(
      { map_id: 1, id: { $ne: 1 } },
      { $set: { map_id: 99, update_time: now } }
    );
    if (moved.modifiedCount > 0) console.log(`[seed-e2e] Moved ${moved.modifiedCount} non-test monsters from map1 to map99`);

    const drawMonster = {
      id: 2, name: 'E2E平局怪', level: 1, hp: 10, mp: 0,
      phy_atk: 100, phy_def: 0, mag_atk: 0, mag_def: 0,
      hit_rate: 100, dodge_rate: 0, crit_rate: 0,
      exp: 0, gold: 0, reputation: 0, map_id: 2,
      create_time: now, update_time: now
    };
    if (!(await monsterColl.findOne({ id: 2 }))) {
      await monsterColl.insertOne(drawMonster);
      await counterColl.updateOne({ name: 'monster' }, { $max: { seq: 2 } }, { upsert: true });
      console.log('[seed-e2e] Inserted draw monster');
    } else {
      await monsterColl.updateOne({ id: 2 }, { $set: { ...drawMonster, update_time: now } });
    }

    // -- 商店 (price: 0 for testing) --
    const testShopItems = [
      { item_id: 1, category: 'consumable', sort_order: 1 },
      { item_id: TEST_WEAPON_ID, category: 'equipment', sort_order: 3 },
      { item_id: em.stone, category: 'material', sort_order: 4 },
      { item_id: em.blessing_oil, category: 'material', sort_order: 5 },
    ];
    for (const entry of testShopItems) {
      if (!(await shopColl.findOne({ item_id: entry.item_id, shop_type: 'gold' }))) {
        const shopId = await nextId(counterColl, 'shop');
        await shopColl.insertOne({
          id: shopId, shop_type: 'gold', item_id: entry.item_id,
          price: 0, category: entry.category, sort_order: entry.sort_order,
          enabled: true, create_time: now, update_time: now
        });
        console.log(`[seed-e2e] Inserted shop: item_id=${entry.item_id}`);
      }
    }

    // -- 技能书 + 技能 --
    const SKILL_BOOK_ITEM_ID = 14;
    if (!(await itemColl.findOne({ id: SKILL_BOOK_ITEM_ID }))) {
      await itemColl.insertOne({ id: SKILL_BOOK_ITEM_ID, name: '技能书·火球术', type: 4, pos: 0, description: '学习火球术', create_time: now, update_time: now });
      console.log('[seed-e2e] Inserted skill book (id=14)');
    }
    if (!(await skillColl.findOne({ id: 1 }))) {
      await skillColl.insertOne({ id: 1, name: '火球术', type: 1, damage: 20, mp_cost: 5, book_id: SKILL_BOOK_ITEM_ID, cost: 0, probability: 100, create_time: now, update_time: now });
      await counterColl.updateOne({ name: 'skill' }, { $max: { seq: 1 } }, { upsert: true });
      console.log('[seed-e2e] Inserted skill: 火球术');
    } else {
      await skillColl.updateOne({ id: 1 }, { $set: { book_id: SKILL_BOOK_ITEM_ID, update_time: now } });
    }
    if (!(await effectColl.findOne({ item_id: SKILL_BOOK_ITEM_ID }))) {
      const effId = await nextId(counterColl, 'item_effect');
      await effectColl.insertOne({ id: effId, item_id: SKILL_BOOK_ITEM_ID, effect_type: 'learn_skill', create_time: now, update_time: now });
    }
    if (!(await shopColl.findOne({ item_id: SKILL_BOOK_ITEM_ID }))) {
      const shopId = await nextId(counterColl, 'shop');
      await shopColl.insertOne({ id: shopId, shop_type: 'gold', item_id: SKILL_BOOK_ITEM_ID, price: 0, category: 'tool', sort_order: 2, enabled: true, create_time: now, update_time: now });
    }

    // -- E2E 商店额外测试商品 --
    const e2eBoostIds = funcCfg.boost_ids || [101,102,103,104,105,106,107,108,109,110,111,112];
    const extraShop = [
      { itemId: funcCfg.expand_bag ?? 11, itemName: '扩容袋' },
      { itemId: e2eBoostIds[0] ?? 101, itemName: '双倍经验卡' },
      { itemId: funcCfg.vip_card ?? 201, itemName: 'VIP卡' }
    ];
    for (const [idx, { itemId, itemName }] of extraShop.entries()) {
      if (!(await shopColl.findOne({ shop_type: 'gold', item_id: itemId }))) {
        const shopId = await nextId(counterColl, 'shop');
        await shopColl.insertOne({ id: shopId, shop_type: 'gold', item_id: itemId, price: 0, category: 'tool', sort_order: 6 + idx, enabled: true, create_time: now, update_time: now });
        console.log(`[seed-e2e] Inserted shop: ${itemName}`);
      }
    }

    // -- 声望/积分商店 --
    if (!(await shopColl.findOne({ shop_type: 'reputation' }))) {
      const shopId = await nextId(counterColl, 'shop');
      await shopColl.insertOne({ id: shopId, shop_type: 'reputation', item_id: 1, price: 5, category: 'consumable', sort_order: 1, enabled: true, create_time: now, update_time: now });
    }
    if (!(await shopColl.findOne({ shop_type: 'points' }))) {
      const shopId = await nextId(counterColl, 'shop');
      await shopColl.insertOne({ id: shopId, shop_type: 'points', item_id: 2, price: 10, category: 'consumable', sort_order: 1, enabled: true, create_time: now, update_time: now });
    }

    // -- Boss --
    if (!(await bossColl.findOne({ id: 1 }))) {
      await bossColl.insertOne({
        id: 1, name: '测试Boss', level: 1, hp: 100, mp: 20,
        phy_atk: 10, phy_def: 5, mag_atk: 0, mag_def: 0,
        hit_rate: 85, dodge_rate: 5, crit_rate: 5,
        exp: 50, gold: 20, reputation: 5, map_id: 1,
        create_time: now, update_time: now
      });
      await counterColl.updateOne({ name: 'boss' }, { $max: { seq: 1 } }, { upsert: true });
      console.log('[seed-e2e] Inserted test boss');
    }

    console.log('[seed-e2e] E2E seed data complete.');
  } catch (error) {
    console.error('[seed-e2e] Error:', error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedE2E();
