/**
 * 数据库初始化：创建集合 + 插入功能性道具
 * 所有功能性道具 ID 从 config 读取，无硬编码。修改 config 表即可调整 ID。
 * 装备、药水、技能书、怪物、地图、等级经验、商店等由 GM 工具创建。
 */
const { MongoClient } = require('mongodb');

const DEFAULT_FUNCTIONAL_ITEMS = {
  enhance_materials: { stone: 6, lucky: 8, anti_explode: 7, blessing_oil: 10 },
  expand_bag: 11,
  vip_card: 201,
  boost_ids: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112],
  stat_fruit_ids: [120, 121, 122, 123, 124, 125],
};

async function initMongoDB() {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    console.log('MongoDB connected successfully');

    const db = client.db('turn-based-game');

    const collections = [
      'user',
      'player',
      'bag',
      'equip_instance',
      'user_equip',
      'skill',
      'player_skill',
      'monster',
      'monster_drop',
      'boss',
      'boss_state',
      'boss_drop',
      'map',
      'level_exp',
      'item',
      'equip_base',
      'item_effect',
      'shop',
      'config',
      'auction',
      'auction_record',
      'counter'
    ];

    for (const name of collections) {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) {
        await db.createCollection(name);
        console.log(`Created collection: ${name}`);
      }
    }

    const equipExists = await db.listCollections({ name: 'equip' }).hasNext();
    if (equipExists) {
      await db.collection('equip').drop();
      console.log('Dropped deprecated collection: equip');
    }

    const itemColl = db.collection('item');
    const effectColl = db.collection('item_effect');
    const configColl = db.collection('config');
    const counterColl = db.collection('counter');
    const now = Math.floor(Date.now() / 1000);

    // 读取/写入 functional_items 配置（统一管理所有功能性道具 ID）
    let funcCfg = DEFAULT_FUNCTIONAL_ITEMS;
    const existingFunc = await configColl.findOne({ name: 'functional_items' });
    if (!existingFunc) {
      const cfgId = await nextId(counterColl, 'config');
      await configColl.insertOne({
        id: cfgId,
        name: 'functional_items',
        value: JSON.stringify(funcCfg),
        create_time: now,
        update_time: now
      });
      console.log('Inserted config: functional_items');
    } else {
      try {
        funcCfg = { ...DEFAULT_FUNCTIONAL_ITEMS, ...JSON.parse(existingFunc.value || '{}') };
        if (!Array.isArray(funcCfg.boost_ids)) funcCfg.boost_ids = DEFAULT_FUNCTIONAL_ITEMS.boost_ids;
        if (!Array.isArray(funcCfg.stat_fruit_ids)) funcCfg.stat_fruit_ids = DEFAULT_FUNCTIONAL_ITEMS.stat_fruit_ids;
      } catch (e) {
        funcCfg = DEFAULT_FUNCTIONAL_ITEMS;
      }
      await configColl.updateOne({ name: 'functional_items' }, { $set: { value: JSON.stringify(funcCfg), update_time: now } });
    }

    const em = funcCfg.enhance_materials || DEFAULT_FUNCTIONAL_ITEMS.enhance_materials;
    await upsertConfig(configColl, counterColl, 'enhance_materials', em, now);

    // 1. 强化材料
    const MATERIAL_ITEMS = [
      { id: em.stone, name: '强化石', type: 3, pos: 0, description: '强化消耗材料' },
      { id: em.anti_explode, name: '防爆符', type: 3, pos: 0, description: '强化失败时装备不损坏' },
      { id: em.lucky, name: '幸运符', type: 3, pos: 0, description: '强化时提高20%成功率' },
      { id: em.blessing_oil, name: '祝福油', type: 3, pos: 0, description: '装备祝福，50%成功率，每次消耗100万金币' }
    ];
    for (const it of MATERIAL_ITEMS) {
      const ex = await itemColl.findOne({ id: it.id });
      if (!ex) {
        await itemColl.insertOne({ ...it, create_time: now, update_time: now });
        console.log(`Inserted material: ${it.name} (id=${it.id})`);
      } else {
        await itemColl.updateOne({ id: it.id }, { $set: { ...it, update_time: now } });
      }
    }

    // 2. 扩容袋
    const expandBagId = funcCfg.expand_bag ?? 11;
    const expandBag = { id: expandBagId, name: '扩容袋', type: 4, pos: 0, description: '使用后增加背包装备容量' };
    if (!(await itemColl.findOne({ id: expandBagId }))) {
      await itemColl.insertOne({ ...expandBag, create_time: now, update_time: now });
      console.log(`Inserted expand bag (id=${expandBagId})`);
    }
    if (!(await effectColl.findOne({ item_id: expandBagId }))) {
      const effId = await nextId(counterColl, 'item_effect');
      await effectColl.insertOne({ id: effId, item_id: expandBagId, effect_type: 'expand_bag', value: 50, max: 500, create_time: now, update_time: now });
      console.log('Inserted item_effect: expand_bag');
    }

    // 3. 多倍卡
    const boostIds = funcCfg.boost_ids || DEFAULT_FUNCTIONAL_ITEMS.boost_ids;
    const BOOST_DEFS = [
      { name: '双倍经验卡', boost_category: 'exp', boost_multiplier: 2 },
      { name: '四倍经验卡', boost_category: 'exp', boost_multiplier: 4 },
      { name: '八倍经验卡', boost_category: 'exp', boost_multiplier: 8 },
      { name: '双倍金币卡', boost_category: 'gold', boost_multiplier: 2 },
      { name: '四倍金币卡', boost_category: 'gold', boost_multiplier: 4 },
      { name: '八倍金币卡', boost_category: 'gold', boost_multiplier: 8 },
      { name: '双倍掉落卡', boost_category: 'drop', boost_multiplier: 2 },
      { name: '四倍掉落卡', boost_category: 'drop', boost_multiplier: 4 },
      { name: '八倍掉落卡', boost_category: 'drop', boost_multiplier: 8 },
      { name: '双倍声望卡', boost_category: 'reputation', boost_multiplier: 2 },
      { name: '四倍声望卡', boost_category: 'reputation', boost_multiplier: 4 },
      { name: '八倍声望卡', boost_category: 'reputation', boost_multiplier: 8 },
    ];
    for (let i = 0; i < BOOST_DEFS.length && i < boostIds.length; i++) {
      const id = boostIds[i];
      const def = BOOST_DEFS[i];
      const it = { id, name: def.name, type: 5, boost_category: def.boost_category, boost_multiplier: def.boost_multiplier, boost_charges: 100, description: `使用后增加100次${def.name.replace('卡', '')}` };
      const ex = await itemColl.findOne({ id });
      if (!ex) {
        await itemColl.insertOne({ ...it, create_time: now, update_time: now });
        console.log(`Inserted boost: ${it.name} (id=${id})`);
      } else {
        await itemColl.updateOne({ id }, { $set: { ...it, update_time: now } });
      }
      if (!(await effectColl.findOne({ item_id: id }))) {
        const effId = await nextId(counterColl, 'item_effect');
        await effectColl.insertOne({ id: effId, item_id: id, effect_type: 'boost', create_time: now, update_time: now });
      }
    }
    console.log('Boost items initialized.');

    // 4. 永久属性果实
    const statIds = funcCfg.stat_fruit_ids || DEFAULT_FUNCTIONAL_ITEMS.stat_fruit_ids;
    const STAT_DEFS = [
      { name: '血菩提', attr: 'max_hp', value: 10, also_add_current: true, desc: '永久增加10点生命上限' },
      { name: '魔法果', attr: 'max_mp', value: 5, also_add_current: true, desc: '永久增加5点魔法上限' },
      { name: '武力之果', attr: 'phy_atk', value: 1, also_add_current: false, desc: '永久增加1点物理攻击' },
      { name: '法术之果', attr: 'mag_atk', value: 1, also_add_current: false, desc: '永久增加1点魔法攻击' },
      { name: '物防之果', attr: 'phy_def', value: 1, also_add_current: false, desc: '永久增加1点物理防御' },
      { name: '法防之果', attr: 'mag_def', value: 1, also_add_current: false, desc: '永久增加1点魔法防御' },
    ];
    for (let i = 0; i < STAT_DEFS.length && i < statIds.length; i++) {
      const id = statIds[i];
      const def = STAT_DEFS[i];
      const { attr, value, also_add_current, desc, name } = def;
      const itemData = { id, name, type: 4, pos: 0, description: desc };
      const ex = await itemColl.findOne({ id });
      if (!ex) {
        await itemColl.insertOne({ ...itemData, create_time: now, update_time: now });
        console.log(`Inserted stat fruit: ${name} (id=${id})`);
      } else {
        await itemColl.updateOne({ id }, { $set: { ...itemData, update_time: now } });
      }
      const eff = await effectColl.findOne({ item_id: id });
      const effPayload = { effect_type: 'add_stat', attr, value, also_add_current: !!also_add_current, update_time: now };
      if (!eff) {
        const effId = await nextId(counterColl, 'item_effect');
        await effectColl.insertOne({ id: effId, item_id: id, ...effPayload, create_time: now });
      } else {
        await effectColl.updateOne({ item_id: id }, { $set: effPayload });
      }
    }
    console.log('Stat fruits initialized.');

    // 5. VIP 卡
    const vipId = funcCfg.vip_card ?? 201;
    const vipItem = { id: vipId, name: 'VIP卡（月卡）', type: 6, pos: 0, vip_days: 30, description: '使用后增加30天VIP时间' };
    if (!(await itemColl.findOne({ id: vipId }))) {
      await itemColl.insertOne({ ...vipItem, create_time: now, update_time: now });
      console.log(`Inserted VIP card (id=${vipId})`);
    } else {
      await itemColl.updateOne({ id: vipId }, { $set: { ...vipItem, update_time: now } });
    }
    if (!(await effectColl.findOne({ item_id: vipId }))) {
      const effId = await nextId(counterColl, 'item_effect');
      await effectColl.insertOne({ id: effId, item_id: vipId, effect_type: 'vip', create_time: now, update_time: now });
      console.log('Inserted item_effect: vip');
    }

    // 更新 item counter，确保 GM 不填 ID 时自增不会与功能性道具冲突
    const maxItemId = Math.max(
      em.stone, em.anti_explode, em.lucky, em.blessing_oil,
      expandBagId, vipId,
      ...(boostIds || []),
      ...(statIds || [])
    );
    await counterColl.updateOne(
      { name: 'item' },
      { $max: { seq: maxItemId } },
      { upsert: true }
    );
    console.log(`Updated item counter: seq >= ${maxItemId}`);

    console.log('MongoDB initialization completed.');
  } catch (error) {
    console.error('Error initializing MongoDB:', error);
  } finally {
    await client.close();
  }
}

async function nextId(counterColl, name) {
  const r = await counterColl.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return (r && typeof r.seq === 'number') ? r.seq : 1;
}

async function upsertConfig(configColl, counterColl, name, value, now) {
  const existing = await configColl.findOne({ name });
  const strVal = JSON.stringify(value);
  if (!existing) {
    const cfgId = await nextId(counterColl, 'config');
    await configColl.insertOne({ id: cfgId, name, value: strVal, create_time: now, update_time: now });
  } else {
    await configColl.updateOne({ name }, { $set: { value: strVal, update_time: now } });
  }
}

initMongoDB();
