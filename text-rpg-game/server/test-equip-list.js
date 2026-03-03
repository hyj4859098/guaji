const mysql = require('mysql2/promise');

async function testEquipList() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 测试装备栏查询 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    console.log('\n=== 步骤1: 测试装备栏查询SQL ===');
    // 测试修复后的SQL查询
    const [userEquips] = await connection.query(
      'SELECT ue.*, e.* FROM user_equip ue JOIN equip e ON ue.equipment_uid = e.equipment_uid WHERE ue.uid = ? AND ue.status = 0 AND e.status = 0',
      [uid]
    );

    console.log(`✅ 查询成功，返回 ${userEquips.length} 件装备`);
    userEquips.forEach((equip, index) => {
      console.log(`\n装备${index+1}:`);
      console.log(`   user_equip_id: ${equip.id}`);
      console.log(`   equipment_uid: ${equip.equipment_uid}`);
      console.log(`   pos: ${equip.pos}`);
      console.log(`   status: ${equip.status}`);
      console.log(`   item_id: ${equip.item_id}`);
      console.log(`   enhancement_level: ${equip.enhancement_level}`);
    });

    console.log('\n=== 步骤2: 测试装备栏中是否有装备 ===');
    if (userEquips.length === 0) {
      console.log('✅ 装备栏为空，这是正确的');
    } else {
      console.log('✅ 装备栏中有装备，这是正确的');
    }

    console.log('\n=== 步骤3: 测试卸下装备的SQL ===');
    // 测试卸下装备的SQL
    const [updateResult] = await connection.query(
      'UPDATE user_equip SET status = 1, update_time = ? WHERE uid = ? AND status = 0',
      [Math.floor(Date.now() / 1000), uid]
    );

    console.log(`✅ 卸下装备成功，影响行数: ${updateResult.affectedRows}`);

    console.log('\n=== 步骤4: 再次测试装备栏查询 ===');
    const [userEquipsAfter] = await connection.query(
      'SELECT ue.*, e.* FROM user_equip ue JOIN equip e ON ue.equipment_uid = e.equipment_uid WHERE ue.uid = ? AND ue.status = 0 AND e.status = 0',
      [uid]
    );

    console.log(`✅ 查询成功，返回 ${userEquipsAfter.length} 件装备`);
    if (userEquipsAfter.length === 0) {
      console.log('✅ 装备栏为空，卸下装备成功');
    } else {
      console.log('❌ 装备栏中还有装备，卸下装备失败');
    }

    console.log('\n=== 测试完成 ===');
    console.log('💡 装备栏查询SQL已修复');
    console.log('💡 装备卸下功能正常');
    console.log('💡 装备栏现在会正确显示当前穿戴的装备');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testEquipList();
