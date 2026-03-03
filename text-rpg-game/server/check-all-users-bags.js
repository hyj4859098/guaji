const mysql = require('mysql2/promise');

async function checkAllUsersBags() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 检查所有用户的背包数据
    console.log('\n=== 检查所有用户的背包数据 ===');
    const [users] = await connection.execute('SELECT id, username FROM user');
    
    for (const user of users) {
      console.log(`\n用户 ${user.username} (uid: ${user.id}):`);
      
      const [bags] = await connection.execute(
        'SELECT b.*, i.name as item_name, i.type as item_type FROM bag b LEFT JOIN item i ON b.item_id = i.id WHERE b.uid = ?',
        [user.id]
      );
      
      console.log(`  背包物品数量: ${bags.length}`);
      
      for (const bag of bags) {
        console.log(`  - Bag ID: ${bag.id}, 物品: ${bag.item_name}, 类型: ${bag.item_type}, equipment_uid: ${bag.equipment_uid}`);
        
        if (bag.equipment_uid) {
          const [equip] = await connection.execute(
            'SELECT * FROM equip WHERE equipment_uid = ?',
            [bag.equipment_uid]
          );
          if (equip.length > 0) {
            const e = equip[0];
            console.log(`    装备属性: HP=${e.hp}, 物理攻击=${e.phy_atk}, 物理防御=${e.phy_def}, MP=${e.mp}, 魔法防御=${e.mag_def}, 魔法攻击=${e.mag_atk}, 命中=${e.hit_rate}%, 闪避=${e.dodge_rate}%, 暴击=${e.crit_rate}%, 等级=${e.level}`);
          } else {
            console.log(`    装备属性: ❌ 未找到对应equip记录`);
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

checkAllUsersBags();
