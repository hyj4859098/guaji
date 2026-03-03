const mysql = require('mysql2/promise');

async function testRealAPI() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 检查当前登录的用户
    console.log('\n=== 检查当前登录用户 ===');
    const [users] = await connection.execute('SELECT id, username, uid FROM user LIMIT 5');
    console.log('用户列表:', users);

    // 检查所有用户的背包数据
    console.log('\n=== 检查所有用户的背包数据 ===');
    for (const user of users) {
      console.log(`\n用户 ${user.username} (uid: ${user.uid}):`);
      
      const [bags] = await connection.execute(
        'SELECT b.*, i.name as item_name, i.type as item_type FROM bag b LEFT JOIN item i ON b.item_id = i.id WHERE b.uid = ?',
        [user.uid]
      );
      
      console.log(`  背包物品数量: ${bags.length}`);
      
      for (const bag of bags) {
        console.log(`  - 物品ID: ${bag.id}, 名称: ${bag.item_name}, 类型: ${bag.item_type}, equipment_uid: ${bag.equipment_uid}`);
        
        if (bag.equipment_uid) {
          const [equip] = await connection.execute(
            'SELECT * FROM equip WHERE equipment_uid = ?',
            [bag.equipment_uid]
          );
          if (equip.length > 0) {
            console.log(`    装备属性: 物理攻击=${equip[0].phy_atk}, 等级=${equip[0].level}`);
          } else {
            console.log(`    装备属性: 未找到对应equip记录`);
          }
        }
      }
    }

    // 关闭连接
    await connection.end();
    console.log('\n✅ 测试完成，连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testRealAPI();
