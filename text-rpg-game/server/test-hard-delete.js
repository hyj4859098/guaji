const mysql = require('mysql2/promise');

async function testHardDelete() {
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

    console.log('\n=== 步骤1: 检查初始状态 ===');
    const [userEquipsBefore] = await connection.query('SELECT * FROM user_equip WHERE uid = ?', [uid]);
    console.log(`✅ user_equip表中共有 ${userEquipsBefore.length} 条记录`);
    userEquipsBefore.forEach((item, index) => {
      console.log(`   记录${index+1}: id=${item.id}, status=${item.status}`);
    });

    console.log('\n=== 步骤2: 测试硬删除 ===');
    // 硬删除所有user_equip记录
    const [deleteResult] = await connection.query('DELETE FROM user_equip WHERE uid = ?', [uid]);
    console.log(`✅ 硬删除成功，删除了 ${deleteResult.affectedRows} 条记录`);

    console.log('\n=== 步骤3: 检查删除后状态 ===');
    const [userEquipsAfter] = await connection.query('SELECT * FROM user_equip WHERE uid = ?', [uid]);
    console.log(`✅ user_equip表中共有 ${userEquipsAfter.length} 条记录`);
    if (userEquipsAfter.length === 0) {
      console.log('✅ 硬删除成功，表中没有记录');
    }

    console.log('\n=== 硬删除机制测试完成 ===');
    console.log('💡 现在开始修改代码，将所有软删除改为硬删除');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testHardDelete();
