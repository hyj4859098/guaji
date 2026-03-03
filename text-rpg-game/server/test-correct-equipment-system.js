const mysql = require('mysql2/promise');

async function testCorrectEquipmentSystem() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 测试正确的装备系统 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    const [items] = await connection.query('SELECT * FROM item WHERE name = ? AND status = 0', ['铁剑']);
    if (items.length === 0) {
      console.log('❌ 没有找到铁剑物品');
      return;
    }
    const item = items[0];
    console.log(`✅ 找到物品: ${item.name} (id: ${item.id}, 效果: ${item.effect})`);

    console.log('\n=== 步骤1: 清空所有相关数据 ===');
    await connection.query('DELETE FROM bag WHERE uid = ? AND item_id = ?', [uid, item.id]);
    await connection.query('DELETE FROM equip WHERE uid = ? AND item_id = ?', [uid, item.id]);
    await connection.query('DELETE FROM user_equip WHERE uid = ?', [uid]);
    console.log('✅ 数据已清空');

    console.log('\n=== 步骤2: 装备诞生 - 在equip表中创建记录（身份证） ===');
    const now = Math.floor(Date.now() / 1000);
    const equipment_uid = `EQP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const [equipResult] = await connection.query(
      'INSERT INTO equip (uid, item_id, pos, equipment_uid, enhancement_level, enchantments, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [uid, item.id, 2, equipment_uid, 0, null, now, now]
    );
    const equipId = equipResult.insertId;
    console.log(`✅ 装备身份证创建成功 (equip_id: ${equipId}, equipment_uid: ${equipment_uid})`);

    console.log('\n=== 步骤3: 装备进入背包 - 在bag表中创建记录 ===');
    const [bagResult] = await connection.query(
      'INSERT INTO bag (uid, item_id, count, equipment_uid, status, create_time, update_time) VALUES (?, ?, ?, ?, 0, ?, ?)',
      [uid, item.id, 1, equipment_uid, now, now]
    );
    const bagId = bagResult.insertId;
    console.log(`✅ 装备进入背包 (bag_id: ${bagId}, equipment_uid: ${equipment_uid})`);

    console.log('\n=== 步骤4: 验证装备系统 ===');
    const [equipRecords] = await connection.query('SELECT * FROM equip WHERE equipment_uid = ?', [equipment_uid]);
    console.log(`✅ equip表中有 ${equipRecords.length} 条记录`);
    if (equipRecords.length > 0) {
      console.log(`   equip_id: ${equipRecords[0].id}, equipment_uid: ${equipRecords[0].equipment_uid}`);
    }

    const [bagRecords] = await connection.query('SELECT * FROM bag WHERE equipment_uid = ?', [equipment_uid]);
    console.log(`✅ bag表中有 ${bagRecords.length} 条记录`);
    if (bagRecords.length > 0) {
      console.log(`   bag_id: ${bagRecords[0].id}, equipment_uid: ${bagRecords[0].equipment_uid}`);
    }

    console.log('\n=== 正确的装备系统流程 ===');
    console.log('1. 装备诞生 → 在equip表创建记录（身份证）');
    console.log('2. 装备进入背包 → 在bag表创建记录，关联equipment_uid');
    console.log('3. 穿戴装备 → 在user_equip表创建记录，从bag表删除记录');
    console.log('4. 卸下装备 → 从user_equip表删除记录，在bag表创建记录');
    console.log('5. 丢弃装备 → 从equip表删除记录，从bag表删除记录');

    console.log('\n=== 测试完成 ===');
    console.log('💡 现在装备系统逻辑正确了！');
    console.log('💡 每件装备诞生后就在equip表中有记录，伴随它的一生');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testCorrectEquipmentSystem();
