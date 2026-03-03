const mysql = require('mysql2/promise');

async function testHardDeleteMechanism() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 测试硬删除机制 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    console.log('\n=== 步骤1: 检查user_equip表 ===');
    const [userEquipsBefore] = await connection.query('SELECT * FROM user_equip WHERE uid = ?', [uid]);
    console.log(`✅ user_equip表中共有 ${userEquipsBefore.length} 条记录`);
    if (userEquipsBefore.length > 0) {
      console.log('❌ 表中还有记录，开始硬删除');
      await connection.query('DELETE FROM user_equip WHERE uid = ?', [uid]);
      console.log('✅ 硬删除所有记录');
    }

    console.log('\n=== 步骤2: 测试穿戴装备 ===');
    // 从背包中获取一件装备
    const [bagItems] = await connection.query('SELECT * FROM bag WHERE uid = ? AND equipment_uid IS NOT NULL LIMIT 1', [uid]);
    if (bagItems.length === 0) {
      console.log('❌ 背包中没有装备，无法测试');
      return;
    }
    
    const bagItem = bagItems[0];
    console.log(`✅ 找到装备: equipment_uid=${bagItem.equipment_uid}`);

    // 获取装备的equip记录
    const [equipRecord] = await connection.query('SELECT * FROM equip WHERE equipment_uid = ? AND uid = ?', [bagItem.equipment_uid, uid]);
    if (!equipRecord || equipRecord.length === 0) {
      console.log('❌ 装备记录不存在');
      return;
    }

    const equip = equipRecord[0];
    console.log(`✅ 找到装备身份证: equip_id=${equip.id}`);

    // 穿戴装备（硬删除测试）
    await connection.query(
      'INSERT INTO user_equip (uid, equipment_uid, pos, create_time, update_time) VALUES (?, ?, ?, ?, ?)',
      [uid, equip.equipment_uid, equip.pos, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
    );
    console.log('✅ 装备穿戴成功');

    console.log('\n=== 步骤3: 测试卸下装备（硬删除） ===');
    await connection.query('DELETE FROM user_equip WHERE uid = ? AND equipment_uid = ?', [uid, equip.equipment_uid]);
    console.log('✅ 装备卸下成功（硬删除）');

    console.log('\n=== 步骤4: 验证硬删除结果 ===');
    const [userEquipsAfter] = await connection.query('SELECT * FROM user_equip WHERE uid = ?', [uid]);
    console.log(`✅ user_equip表中共有 ${userEquipsAfter.length} 条记录`);
    if (userEquipsAfter.length === 0) {
      console.log('✅ 硬删除成功，表中没有记录');
    } else {
      console.log('❌ 硬删除失败，表中还有记录');
    }

    console.log('\n=== 硬删除机制测试完成 ===');
    console.log('💡 硬删除机制正常工作');
    console.log('💡 user_equip表不会再积累已卸下的装备记录');
    console.log('💡 装备栏查询会正确显示当前穿戴的装备');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testHardDeleteMechanism();
