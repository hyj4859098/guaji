const mysql = require('mysql2/promise');

// 直接创建数据库连接
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'text_rpg'
});

// 替换query函数
const query = async (sql, params) => {
  const conn = await connection;
  return conn.execute(sql, params);
};

async function testEquipSystem() {
  console.log('=== 测试装备系统 ===\n');

  const uid = 1;
  const equipItemIds = [6, 7, 8, 14, 15, 16]; // 铁剑、皮甲、布鞋、新手戒、新手链、新手马

  try {
    // 添加装备到背包
    console.log('1. 添加装备到背包...');
    for (const itemId of equipItemIds) {
      await query(
        'INSERT INTO bag (uid, item_id, count, status, create_time, update_time) VALUES (?, ?, 1, 0, ?, ?)',
        [uid, itemId, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );
      console.log(`  添加装备 ${itemId} 成功`);
    }

    // 查看背包中的装备
    console.log('\n2. 查看背包中的装备...');
    const [bags] = await query('SELECT id, item_id, count FROM bag WHERE uid = ?', [uid]);
    bags.forEach(bag => {
      console.log(`  背包ID: ${bag.id}, 物品ID: ${bag.item_id}, 数量: ${bag.count}`);
    });

    console.log('\n=== 测试完成 ===');
    console.log('请在前端界面上测试以下功能:');
    console.log('1. 装备穿戴: 在背包中点击装备的"穿戴"按钮');
    console.log('2. 装备卸下: 在装备栏中点击装备的"卸下"按钮');
    console.log('3. 装备丢弃: 在背包中点击装备的"丢弃"按钮');
    console.log('4. 验证装备唯一性: 检查每件装备是否都有独立的记录');
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    process.exit();
  }
}

testEquipSystem();
