const mysql = require('mysql2/promise');

async function checkBagData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 检查背包数据 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    console.log('\n=== 1. 查询背包中的所有物品 ===');
    const [bagItems] = await connection.query('SELECT * FROM bag WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 背包中共有 ${bagItems.length} 件物品`);
    bagItems.forEach((item, index) => {
      console.log(`\n物品${index+1}:`);
      console.log(`   id: ${item.id}`);
      console.log(`   item_id: ${item.item_id}`);
      console.log(`   count: ${item.count}`);
      console.log(`   equipment_uid: ${item.equipment_uid}`);
      console.log(`   status: ${item.status}`);
      console.log(`   create_time: ${item.create_time}`);
      console.log(`   update_time: ${item.update_time}`);
    });

    console.log('\n=== 2. 查询装备表中的所有记录 ===');
    const [equipItems] = await connection.query('SELECT * FROM equip WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 装备表中共有 ${equipItems.length} 件装备`);
    equipItems.forEach((item, index) => {
      console.log(`\n装备${index+1}:`);
      console.log(`   id: ${item.id}`);
      console.log(`   item_id: ${item.item_id}`);
      console.log(`   pos: ${item.pos}`);
      console.log(`   equipment_uid: ${item.equipment_uid}`);
      console.log(`   enhancement_level: ${item.enhancement_level}`);
      console.log(`   enchantments: ${item.enchantments}`);
      console.log(`   status: ${item.status}`);
    });

    console.log('\n=== 3. 查询装备栏中的记录 ===');
    const [userEquips] = await connection.query('SELECT * FROM user_equip WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 装备栏中共有 ${userEquips.length} 件装备`);
    userEquips.forEach((item, index) => {
      console.log(`\n装备栏${index+1}:`);
      console.log(`   id: ${item.id}`);
      console.log(`   equipment_uid: ${item.equipment_uid}`);
      console.log(`   pos: ${item.pos}`);
      console.log(`   status: ${item.status}`);
    });

    console.log('\n=== 4. 查询物品表中的铁剑信息 ===');
    const [items] = await connection.query('SELECT * FROM item WHERE name LIKE ?', ['%铁剑%']);
    console.log(`✅ 找到 ${items.length} 件铁剑相关物品`);
    items.forEach((item, index) => {
      console.log(`\n物品${index+1}:`);
      console.log(`   id: ${item.id}`);
      console.log(`   name: ${item.name}`);
      console.log(`   type: ${item.type}`);
      console.log(`   pos: ${item.pos}`);
      console.log(`   effect: ${item.effect}`);
    });

    console.log('\n=== 分析 ===');
    if (bagItems.length > 0) {
      const equipItemsInBag = bagItems.filter(item => item.equipment_uid);
      console.log(`✅ 背包中有 ${equipItemsInBag.length} 件装备（有equipment_uid）`);
      
      if (equipItemsInBag.length > 0) {
        const counts = {};
        equipItemsInBag.forEach(item => {
          const key = item.item_id;
          counts[key] = (counts[key] || 0) + 1;
        });
        console.log('\n装备数量统计:');
        Object.entries(counts).forEach(([itemId, count]) => {
          console.log(`   item_id ${itemId}: ${count} 件`);
        });
      }
    }

    console.log('\n=== 问题分析 ===');
    console.log('❓ 为什么装备会叠加？');
    console.log('1. 检查前端是否正确处理装备的唯一性');
    console.log('2. 检查后端背包列表返回时是否正确处理装备');
    console.log('3. 检查装备穿戴和卸下的逻辑是否正确');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

checkBagData();
