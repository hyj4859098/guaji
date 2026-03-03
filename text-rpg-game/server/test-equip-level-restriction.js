const mysql = require('mysql2/promise');

async function testEquipLevelRestriction() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 测试装备等级限制 ===\n');
    
    console.log('1. 检查当前玩家等级');
    const players = await connection.execute('SELECT * FROM player WHERE uid = 4', []);
    console.log('玩家信息:', JSON.stringify(players[0][0], null, 2));
    
    console.log('\n2. 创建一个需要等级5的装备');
    const now = Math.floor(Date.now() / 1000);
    const equipment_uid = `EQP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    const equipResult = await connection.execute(
      'INSERT INTO equip (uid, item_id, pos, equipment_uid, level, enhancement_level, enchantments, hp, phy_atk, phy_def, mp, mag_def, mag_atk, hit_rate, dodge_rate, crit_rate, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [4, 6, 2, equipment_uid, 5, 0, null, 0, 15, 0, 0, 0, 0, 3, 0, 2, now, now]
    );
    
    console.log('高等级装备创建成功，ID:', equipResult[0].insertId, '需要等级:', 5);
    
    await connection.execute(
      'INSERT INTO bag (uid, item_id, count, equipment_uid, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
      [4, 6, 1, equipment_uid, now, now]
    );
    
    console.log('高等级装备已添加到背包');
    
    console.log('\n3. 检查背包中的装备');
    const bags = await connection.execute(
      'SELECT b.*, e.level as equip_level, e.phy_atk FROM bag b JOIN equip e ON b.equipment_uid = e.equipment_uid WHERE b.uid = 4',
      []
    );
    console.log('背包装备列表:');
    bags[0].forEach((bag, index) => {
      console.log(`${index + 1}. 装备ID: ${bag.id}, 物品ID: ${bag.item_id}, 装备等级: ${bag.equip_level}, 物理攻击: ${bag.phy_atk}, UID: ${bag.equipment_uid}`);
    });
    
    console.log('\n4. 模拟尝试穿戴高等级装备（玩家等级1，装备需要等级5）');
    console.log('预期结果：应该失败，提示"玩家等级不足，需要等级5"');
    
    console.log('\n=== 测试完成 ===');
    console.log('请通过前端界面尝试穿戴高等级装备，验证等级限制功能');
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

testEquipLevelRestriction();
