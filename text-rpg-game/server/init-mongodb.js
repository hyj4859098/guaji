const { MongoClient } = require('mongodb');

async function initMongoDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    // 连接到MongoDB
    await client.connect();
    console.log('MongoDB connected successfully');
    
    // 选择数据库
    const db = client.db('turn-based-game');
    
    // 创建必要的集合
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
      'map',
      'level_exp',
      'item',
      'equip_base'
    ];
    
    for (const collectionName of collections) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        await db.createCollection(collectionName);
        console.log(`Created collection: ${collectionName}`);
      } else {
        console.log(`Collection ${collectionName} already exists`);
      }
    }

    // 删除已废弃的 equip 表（已统一使用 equip_instance）
    const equipExists = await db.listCollections({ name: 'equip' }).hasNext();
    if (equipExists) {
      await db.collection('equip').drop();
      console.log('Dropped deprecated collection: equip');
    }

    // 插入初始物品数据
    const itemCollection = db.collection('item');
    const itemCount = await itemCollection.countDocuments();
    if (itemCount === 0) {
      const items = [
        { id: 1, name: '铁剑', type: 2, pos: 1, description: '一把普通的铁剑' },
        { id: 2, name: '铁盾', type: 2, pos: 2, description: '一把普通的铁盾' },
        { id: 3, name: '小血瓶', type: 1, pos: 0, hp_restore: 50, mp_restore: 0, description: '恢复50点生命值' },
        { id: 4, name: '小蓝瓶', type: 3, pos: 0, hp_restore: 0, mp_restore: 30, description: '恢复30点魔法值' },
        { id: 5, name: '技能书-火球术', type: 4, pos: 0, description: '学习火球术技能' }
      ];
      await itemCollection.insertMany(items);
      console.log('Inserted initial item data');
    } else {
      // 迁移：为旧的血药蓝药补充 hp_restore/mp_restore（缺省时用 effect_value 或默认值）
      const bloodPotion = await itemCollection.findOne({ type: 1 });
      if (bloodPotion && bloodPotion.hp_restore == null) {
        const val = bloodPotion.effect_value ?? 50;
        await itemCollection.updateMany({ type: 1 }, { $set: { hp_restore: val, mp_restore: 0 } });
        console.log('Migrated blood potions: hp_restore/mp_restore');
      }
      const manaPotion = await itemCollection.findOne({ type: 3 });
      if (manaPotion && manaPotion.mp_restore == null) {
        const val = manaPotion.effect_value ?? 30;
        await itemCollection.updateMany({ type: 3 }, { $set: { hp_restore: 0, mp_restore: val } });
        console.log('Migrated mana potions: hp_restore/mp_restore');
      }

      // 自动补充材料物品
      const materialItems = [
        { id: 6, name: '强化石', type: 3, pos: 0, description: '装备强化材料' },
        { id: 7, name: '装备防爆符', type: 3, pos: 0, description: '强化失败时防止装备损坏' },
        { id: 8, name: '装备幸运符', type: 3, pos: 0, description: '强化时提高20%成功率' },
        { id: 10, name: '祝福油', type: 3, pos: 0, description: '装备祝福材料，50%成功率' },
      ];
      for (const mat of materialItems) {
        const exists = await itemCollection.findOne({ id: mat.id });
        if (!exists) {
          await itemCollection.insertOne(mat);
          console.log(`Inserted material item: ${mat.name} (id=${mat.id})`);
        }
      }
    }
    
    // 插入初始装备基础数据
    const equipBaseCollection = db.collection('equip_base');
    const equipBaseCount = await equipBaseCollection.countDocuments();
    if (equipBaseCount === 0) {
      const equipBases = [
        {
          item_id: 1,
          pos: 1,
          base_level: 1,
          base_hp: 0,
          base_phy_atk: 10,
          base_phy_def: 0,
          base_mp: 0,
          base_mag_def: 0,
          base_mag_atk: 0,
          base_hit_rate: 5,
          base_dodge_rate: 0,
          base_crit_rate: 5
        },
        {
          item_id: 2,
          pos: 2,
          base_level: 1,
          base_hp: 0,
          base_phy_atk: 0,
          base_phy_def: 5,
          base_mp: 0,
          base_mag_def: 5,
          base_mag_atk: 0,
          base_hit_rate: 0,
          base_dodge_rate: 5,
          base_crit_rate: 0
        }
      ];
      await equipBaseCollection.insertMany(equipBases);
      console.log('Inserted initial equip_base data');
    }
    
    // 插入初始技能数据（统一只使用 id，不再使用 skill_id）
    const skillCollection = db.collection('skill');
    const skillCount = await skillCollection.countDocuments();
    if (skillCount === 0) {
      const now = Math.floor(Date.now() / 1000);
      const skills = [
        {
          id: 1,
          uid: 0,
          name: '火球术',
          type: 1,  // 0=物理 1=魔法，火球术为魔法
          cost: 10,
          damage: 20,
          probability: 90,
          book_id: 5,
          description: '释放一个火球，造成20点魔法伤害',
          create_time: now,
          update_time: now
        }
      ];
      await skillCollection.insertMany(skills);
      const counterCollection = db.collection('counter');
      await counterCollection.updateOne(
        { name: 'skill' },
        { $set: { seq: 1 } },
        { upsert: true }
      );
      console.log('Inserted initial skill data');
    } else {
      // 迁移：若存在 skill_id 字段，统一为 id 并删除 skill_id
      const skillsWithLegacyId = await skillCollection.find({ skill_id: { $exists: true } }).toArray();
      if (skillsWithLegacyId.length > 0) {
        for (const doc of skillsWithLegacyId) {
          const newId = doc.id != null ? doc.id : doc.skill_id;
          await skillCollection.updateOne(
            { _id: doc._id },
            { $set: { id: newId }, $unset: { skill_id: '' } }
          );
        }
        const counterCollection = db.collection('counter');
        const allSkills = await skillCollection.find({}, { projection: { id: 1 } }).toArray();
        const maxId = Math.max(0, ...allSkills.map(d => d.id).filter(n => typeof n === 'number'));
        if (maxId > 0) {
          await counterCollection.updateOne(
            { name: 'skill' },
            { $max: { seq: maxId } },
            { upsert: true }
          );
        }
        console.log('Migrated skill collection: removed skill_id, unified to id');
      }
    }
    
    // 插入初始怪物数据
    const monsterCollection = db.collection('monster');
    const monsterCount = await monsterCollection.countDocuments();
    if (monsterCount === 0) {
      const monsters = [
        {
          id: 1,
          name: '哥布林',
          level: 1,
          hp: 50,
          mp: 0,
          phy_atk: 5,
          phy_def: 2,
          mag_atk: 0,
          mag_def: 0,
          hit_rate: 80,
          dodge_rate: 10,
          crit_rate: 5,
          exp: 10,
          gold: 5,
          reputation: 1,
          map_id: 1,
          description: '低级怪物，攻击力较低',
          drop_items: [{ item_id: 1, prob: 25 }, { item_id: 2, prob: 20 }],
          create_time: Math.floor(Date.now() / 1000),
          update_time: Math.floor(Date.now() / 1000)
        },
        {
          id: 2,
          name: '骷髅兵',
          level: 2,
          hp: 80,
          mp: 0,
          phy_atk: 8,
          phy_def: 3,
          mag_atk: 0,
          mag_def: 0,
          hit_rate: 85,
          dodge_rate: 15,
          crit_rate: 8,
          exp: 20,
          gold: 10,
          reputation: 2,
          map_id: 1,
          description: '中级怪物，防御力较高',
          drop_items: [{ item_id: 1, prob: 30 }, { item_id: 2, prob: 25 }],
          create_time: Math.floor(Date.now() / 1000),
          update_time: Math.floor(Date.now() / 1000)
        }
      ];
      await monsterCollection.insertMany(monsters);
      console.log('Inserted initial monster data');
    }

    // 迁移：将怪物内嵌的 drop_items 迁移到 monster_drop 表，并移除怪物中的 drop_items
    const monsterDropCollection = db.collection('monster_drop');
    const monsterDropCount = await monsterDropCollection.countDocuments();
    if (monsterDropCount === 0) {
      const monstersWithDrops = await monsterCollection.find({ drop_items: { $exists: true, $ne: [] } }).toArray();
      let dropId = 1;
      const dropDocs = [];
      for (const m of monstersWithDrops) {
        for (const d of m.drop_items || []) {
          dropDocs.push({
            id: dropId++,
            monster_id: m.id,
            item_id: d.item_id,
            quantity: 1,
            probability: d.prob || 0,
            create_time: Math.floor(Date.now() / 1000),
            update_time: Math.floor(Date.now() / 1000)
          });
        }
      }
      if (dropDocs.length > 0) {
        await monsterDropCollection.insertMany(dropDocs);
        const maxId = Math.max(...dropDocs.map(d => d.id));
        await db.collection('counter').updateOne({ name: 'monster_drop' }, { $max: { seq: maxId } }, { upsert: true });
        console.log('Migrated drop_items to monster_drop:', dropDocs.length);
      }
      // 移除怪物中的 drop_items 字段
      await monsterCollection.updateMany({ drop_items: { $exists: true } }, { $unset: { drop_items: '' } });
      console.log('Removed drop_items from monster collection');
    }

    // 插入初始 monster_drop 数据（若迁移后仍为空，则用默认数据）
    const finalDropCount = await monsterDropCollection.countDocuments();
    if (finalDropCount === 0) {
      const now = Math.floor(Date.now() / 1000);
      const defaultDrops = [
        { id: 1, monster_id: 1, item_id: 1, quantity: 1, probability: 25, create_time: now, update_time: now },
        { id: 2, monster_id: 1, item_id: 2, quantity: 1, probability: 20, create_time: now, update_time: now },
        { id: 3, monster_id: 2, item_id: 1, quantity: 1, probability: 30, create_time: now, update_time: now },
        { id: 4, monster_id: 2, item_id: 2, quantity: 1, probability: 25, create_time: now, update_time: now }
      ];
      await monsterDropCollection.insertMany(defaultDrops);
      await db.collection('counter').updateOne({ name: 'monster_drop' }, { $set: { seq: 4 } }, { upsert: true });
      console.log('Inserted initial monster_drop data');
    }
    
    // 插入初始地图数据
    const mapCollection = db.collection('map');
    const mapCount = await mapCollection.countDocuments();
    if (mapCount === 0) {
      const maps = [
        {
          id: 1,
          name: '新手村',
          level_min: 1,
          level_max: 5,
          description: '新手玩家的起始地图'
        }
      ];
      await mapCollection.insertMany(maps);
      console.log('Inserted initial map data');
    }
    
    // 插入初始等级经验数据
    const levelExpCollection = db.collection('level_exp');
    const levelExpCount = await levelExpCollection.countDocuments();
    if (levelExpCount === 0) {
      const now = Math.floor(Date.now() / 1000);
      const levelExps = [];
      for (let i = 1; i <= 10; i++) {
        levelExps.push({
          id: i,
          level: i,
          exp: 100 * i,
          create_time: now,
          update_time: now
        });
      }
      await levelExpCollection.insertMany(levelExps);
      const counterCollection = db.collection('counter');
      await counterCollection.updateOne({ name: 'level_exp' }, { $set: { seq: 10 } }, { upsert: true });
      console.log('Inserted initial level_exp data');
    } else {
      // 为没有 id 的 level_exp 文档补全 id（兼容旧数据）
      const withoutId = await levelExpCollection.find({ id: { $exists: false } }).sort({ level: 1 }).toArray();
      if (withoutId.length > 0) {
        const counterCollection = db.collection('counter');
        let seq = await counterCollection.findOne({ name: 'level_exp' }).then(c => (c && c.seq) || 0);
        for (const doc of withoutId) {
          seq += 1;
          await levelExpCollection.updateOne({ _id: doc._id }, { $set: { id: seq } });
        }
        await counterCollection.updateOne({ name: 'level_exp' }, { $set: { seq } }, { upsert: true });
        console.log('Migrated level_exp: added id to', withoutId.length, 'documents');
      }
    }
    
    console.log('MongoDB initialization completed successfully!');
    
  } catch (error) {
    console.error('Error initializing MongoDB:', error);
  } finally {
    // 关闭连接
    await client.close();
  }
}

initMongoDB();
