const mysql = require('mysql2/promise');

async function testRemoveEquip() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 测试卸下装备过程 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    console.log('\n=== 步骤1: 检查初始状态 ===');
    const [bagItemsBefore] = await connection.query('SELECT * FROM bag WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 背包中共有 ${bagItemsBefore.length} 件物品`);
    bagItemsBefore.forEach((item, index) => {
      console.log(`   物品${index+1}: id=${item.id}, equipment_uid=${item.equipment_uid}, count=${item.count}`);
    });

    const [userEquipsBefore] = await connection.query('SELECT * FROM user_equip WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 装备栏中共有 ${userEquipsBefore.length} 件装备`);
    userEquipsBefore.forEach((item, index) => {
      console.log(`   装备${index+1}: id=${item.id}, equipment_uid=${item.equipment_uid}, pos=${item.pos}`);
    });

    if (userEquipsBefore.length === 0) {
      console.log('❌ 装备栏中没有装备，无法测试卸下');
      return;
    }

    const equipToRemove = userEquipsBefore[0];
    console.log(`\n=== 步骤2: 模拟卸下装备 ===`);
    console.log(`卸下装备: equipment_uid=${equipToRemove.equipment_uid}`);

    // 步骤1: 移除装备效果
    const [equipRecord] = await connection.query('SELECT * FROM equip WHERE equipment_uid = ? AND uid = ?', [equipToRemove.equipment_uid, uid]);
    if (equipRecord.length > 0) {
      const [itemInfo] = await connection.query('SELECT effect FROM item WHERE id = ? AND status = 0', [equipRecord[0].item_id]);
      if (itemInfo.length > 0) {
        const effect = JSON.parse(itemInfo[0].effect);
        for (const [attr, value] of Object.entries(effect)) {
          await connection.query(`UPDATE player SET ${attr} = ${attr} - ? WHERE uid = ?`, [value, uid]);
          console.log(`✅ 移除装备效果: ${attr} -${value}`);
        }
      }
    }

    // 步骤2: 将装备栏中的装备标记为已删除
    const now = Math.floor(Date.now() / 1000);
    await connection.query('UPDATE user_equip SET status = 1, update_time = ? WHERE id = ?', [now, equipToRemove.id]);
    console.log(`✅ 装备从装备栏卸下`);

    // 步骤3: 将装备返回背包
    if (equipRecord.length > 0) {
      const [bagResult] = await connection.query(
        'INSERT INTO bag (uid, item_id, count, equipment_uid, status, create_time, update_time) VALUES (?, ?, ?, ?, 0, ?, ?)',
        [uid, equipRecord[0].item_id, 1, equipToRemove.equipment_uid, now, now]
      );
      console.log(`✅ 装备返回背包: bag_id=${bagResult.insertId}, equipment_uid=${equipToRemove.equipment_uid}`);
    }

    console.log('\n=== 步骤3: 检查最终状态 ===');
    const [bagItemsAfter] = await connection.query('SELECT * FROM bag WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 背包中共有 ${bagItemsAfter.length} 件物品`);
    bagItemsAfter.forEach((item, index) => {
      console.log(`   物品${index+1}: id=${item.id}, equipment_uid=${item.equipment_uid}, count=${item.count}`);
    });

    const [userEquipsAfter] = await connection.query('SELECT * FROM user_equip WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 装备栏中共有 ${userEquipsAfter.length} 件装备`);
    userEquipsAfter.forEach((item, index) => {
      console.log(`   装备${index+1}: id=${item.id}, equipment_uid=${item.equipment_uid}, pos=${item.pos}`);
    });

    console.log('\n=== 测试完成 ===');
    console.log('💡 卸下装备后，装备应该作为单独的记录返回背包');
    console.log('💡 每件装备都应该有自己的 equipment_uid');
    console.log('💡 背包中的装备不应该叠加');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testRemoveEquip();
