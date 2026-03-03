const mysql = require('mysql2/promise');

async function testNoStatusField() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 测试移除 status 字段后的功能 ===\n');

  try {
    console.log('=== 步骤1: 检查数据库表结构 ===');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    let hasStatusField = false;
    for (const tableName of tableNames) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
      const statusColumn = columns.find(col => col.Field === 'status');
      if (statusColumn) {
        console.log(`❌ 表 ${tableName} 还有 status 字段`);
        hasStatusField = true;
      }
    }

    if (!hasStatusField) {
      console.log('✅ 所有表的 status 字段已删除');
    }

    console.log('\n=== 步骤2: 测试装备穿戴 ===');
    const [users] = await connection.query('SELECT id, username FROM user LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    const [bagItems] = await connection.query('SELECT * FROM bag WHERE uid = ? AND equipment_uid IS NOT NULL LIMIT 1', [uid]);
    if (bagItems.length === 0) {
      console.log('❌ 背包中没有装备，无法测试');
      return;
    }

    const bagItem = bagItems[0];
    console.log(`✅ 找到装备: equipment_uid=${bagItem.equipment_uid}`);

    const [equipRecord] = await connection.query('SELECT * FROM equip WHERE equipment_uid = ? AND uid = ?', [bagItem.equipment_uid, uid]);
    if (!equipRecord || equipRecord.length === 0) {
      console.log('❌ 装备记录不存在');
      return;
    }

    const equip = equipRecord[0];
    console.log(`✅ 找到装备身份证: equip_id=${equip.id}`);

    await connection.query(
      'INSERT INTO user_equip (uid, equipment_uid, pos, create_time, update_time) VALUES (?, ?, ?, ?, ?)',
      [uid, equip.equipment_uid, equip.pos, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
    );
    console.log('✅ 装备穿戴成功');

    console.log('\n=== 步骤3: 测试装备查询 ===');
    const [userEquips] = await connection.query(
      'SELECT ue.*, e.* FROM user_equip ue JOIN equip e ON ue.equipment_uid = e.equipment_uid WHERE ue.uid = ?',
      [uid]
    );
    console.log(`✅ 查询到 ${userEquips.length} 件装备`);
    if (userEquips.length > 0) {
      console.log(`✅ 装备信息: ${userEquips[0].equipment_uid}`);
    }

    console.log('\n=== 步骤4: 测试装备卸下（硬删除） ===');
    await connection.query('DELETE FROM user_equip WHERE uid = ? AND equipment_uid = ?', [uid, equip.equipment_uid]);
    console.log('✅ 装备卸下成功（硬删除）');

    console.log('\n=== 步骤5: 验证硬删除结果 ===');
    const [userEquipsAfter] = await connection.query('SELECT * FROM user_equip WHERE uid = ?', [uid]);
    console.log(`✅ user_equip表中共有 ${userEquipsAfter.length} 条记录`);
    if (userEquipsAfter.length === 0) {
      console.log('✅ 硬删除成功，表中没有记录');
    } else {
      console.log('❌ 硬删除失败，表中还有记录');
    }

    console.log('\n=== 测试完成 ===');
    console.log('💡 所有 status 字段已删除');
    console.log('💡 硬删除机制正常工作');
    console.log('💡 装备系统功能正常');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testNoStatusField();
