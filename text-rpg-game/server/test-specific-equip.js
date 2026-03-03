const mysql = require('mysql2/promise');

async function testSpecificEquip() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 检查这两个特定的装备UID
    const targetUids = ['EQP_1771848276158_5029', 'EQP_1771848276158_6521'];

    for (const targetUid of targetUids) {
      console.log(`\n=== 检查装备UID: ${targetUid} ===`);
      
      // 检查equip表
      const [equipData] = await connection.execute(
        'SELECT * FROM equip WHERE equipment_uid = ?',
        [targetUid]
      );
      console.log('equip表记录:', equipData[0] || '不存在');
      
      // 检查bag表
      const [bagData] = await connection.execute(
        'SELECT * FROM bag WHERE equipment_uid = ?',
        [targetUid]
      );
      console.log('bag表记录:', bagData[0] || '不存在');
    }

    // 检查uid=1的所有bag记录
    console.log('\n=== 检查uid=1的所有bag记录 ===');
    const [bagUid1] = await connection.execute(
      'SELECT * FROM bag WHERE uid = 1'
    );
    console.log('uid=1的bag记录:', bagUid1);

    // 检查uid=1的所有equip记录
    console.log('\n=== 检查uid=1的所有equip记录 ===');
    const [equipUid1] = await connection.execute(
      'SELECT * FROM equip WHERE uid = 1'
    );
    console.log('uid=1的equip记录:', equipUid1);

    // 关闭连接
    await connection.end();
    console.log('\n✅ 测试完成，连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testSpecificEquip();
