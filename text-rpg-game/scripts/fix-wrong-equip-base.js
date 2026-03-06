/**
 * 修复错误装备配置：将消耗品（如小血瓶 item_id=1）误配置为装备的情况
 * 执行：node scripts/fix-wrong-equip-base.js
 * 需要 MongoDB 运行
 */
const { MongoClient } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'turn-based-game';

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DATABASE);
  const itemColl = db.collection('item');
  const equipBaseColl = db.collection('equip_base');

  // 找出所有 equip_base，检查对应 item 是否为 type 2
  const equipBases = await equipBaseColl.find({}).toArray();
  let fixed = 0;
  for (const eb of equipBases) {
    const item = await itemColl.findOne({ id: eb.item_id });
    if (!item) {
      console.log(`[删除] equip_base item_id=${eb.item_id}，对应 item 不存在`);
      await equipBaseColl.deleteOne({ id: eb.id });
      fixed++;
    } else if (item.type !== 2) {
      console.log(`[删除] equip_base item_id=${eb.item_id}（${item.name}）应为 type ${item.type} 非装备，删除错误配置`);
      await equipBaseColl.deleteOne({ id: eb.id });
      fixed++;
    }
  }

  // 确保小血瓶、小蓝瓶为消耗品
  const consumables = [
    { id: 1, name: '小血瓶', type: 1, hp_restore: 50, mp_restore: 0 },
    { id: 2, name: '小蓝瓶', type: 1, hp_restore: 0, mp_restore: 30 }
  ];
  for (const c of consumables) {
    const ex = await itemColl.findOne({ id: c.id });
    if (ex && ex.type !== 1) {
      console.log(`[修复] item ${c.id}（${c.name}）type 从 ${ex.type} 改回 1`);
      await itemColl.updateOne({ id: c.id }, { $set: { type: 1, hp_restore: c.hp_restore, mp_restore: c.mp_restore, update_time: Math.floor(Date.now() / 1000) } });
      fixed++;
    }
  }

  console.log(`完成，共修复 ${fixed} 处`);
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
