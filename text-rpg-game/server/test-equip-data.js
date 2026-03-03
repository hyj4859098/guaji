const mysql = require('mysql2/promise');

async function testEquipData() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 检查 equip 表结构
    console.log('\n=== 检查 equip 表结构 ===');
    const [equipStructure] = await connection.execute('DESCRIBE equip');
    console.log('equip 表字段:', equipStructure.map(field => field.Field));

    // 检查 equip 表数据
    console.log('\n=== 检查 equip 表数据 ===');
    const [equipData] = await connection.execute('SELECT * FROM equip LIMIT 10');
    console.log('equip 表数据:', equipData);

    // 检查 bag 表数据
    console.log('\n=== 检查 bag 表数据 ===');
    const [bagData] = await connection.execute('SELECT * FROM bag LIMIT 10');
    console.log('bag 表数据:', bagData);

    // 检查装备属性关联
    console.log('\n=== 检查装备属性关联 ===');
    for (const bagItem of bagData) {
      if (bagItem.equipment_uid) {
        const [equipInfo] = await connection.execute(
          'SELECT * FROM equip WHERE equipment_uid = ?',
          [bagItem.equipment_uid]
        );
        console.log(`Bag item ${bagItem.id} (equipment_uid: ${bagItem.equipment_uid}) -> Equip info:`, equipInfo[0]);
      }
    }

    // 关闭连接
    await connection.end();
    console.log('\n✅ 测试完成，连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testEquipData();
