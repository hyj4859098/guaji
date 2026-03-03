const mysql = require('mysql2/promise');

async function createItemTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 创建物品表 ===\n');

  try {
    // 创建物品表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS item (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        type TINYINT NOT NULL COMMENT '1=消耗品 2=装备 3=材料 4=道具',
        effect TEXT COMMENT '物品效果JSON',
        price INT DEFAULT 0 COMMENT '物品价格',
        status TINYINT DEFAULT 0 COMMENT '0=正常 1=删除 2=禁用',
        create_time INT NOT NULL,
        update_time INT NOT NULL,
        INDEX idx_type (type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物品表'
    `);
    console.log('✅ 物品表创建成功');

    // 插入基础物品数据
    const items = [
      { name: '小血瓶', type: 1, effect: '{"hp": 50}', price: 100 },
      { name: '小蓝瓶', type: 1, effect: '{"mp": 50}', price: 100 },
      { name: '复活币', type: 1, effect: '{"resurrect": true}', price: 500 },
      { name: '经验丹', type: 1, effect: '{"exp": 1000}', price: 1000 },
      { name: '金币袋', type: 1, effect: '{"gold": 1000}', price: 800 },
      { name: '铁剑', type: 2, effect: '{"phy_atk": 20}', price: 1500 },
      { name: '皮甲', type: 2, effect: '{"phy_def": 15}', price: 1200 },
      { name: '布鞋', type: 2, effect: '{"speed": 5}', price: 800 }
    ];

    const now = Math.floor(Date.now() / 1000);
    for (const item of items) {
      await connection.query(
        'INSERT INTO item (name, type, effect, price, status, create_time, update_time) VALUES (?, ?, ?, ?, 0, ?, ?)',
        [item.name, item.type, item.effect, item.price, now, now]
      );
      console.log(`✅ 插入物品: ${item.name}`);
    }

    // 测试查询物品表
    const [result] = await connection.query('SELECT id, name, type, price FROM item WHERE status = 0');
    console.log('\n=== 物品表数据 ===');
    result.forEach(item => {
      console.log(`ID: ${item.id}, 名称: ${item.name}, 类型: ${item.type}, 价格: ${item.price}`);
    });

    console.log('\n=== 物品表创建完成 ===');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

createItemTable();
