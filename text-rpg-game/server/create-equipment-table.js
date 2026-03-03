const mysql = require('mysql2/promise');

// 直接创建数据库连接
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'text_rpg'
});

// 替换query函数
const query = async (sql, params) => {
  const conn = await connection;
  return conn.execute(sql, params);
};

async function createEquipmentTable() {
  console.log('=== 创建equipment表 ===\n');

  try {
    // 创建equipment表
    await query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id INT AUTO_INCREMENT PRIMARY KEY,
        equipment_uid VARCHAR(50) UNIQUE NOT NULL,
        item_id INT NOT NULL,
        uid INT NOT NULL,
        pos TINYINT DEFAULT 0 COMMENT '装备位置: 0=无 1=坐骑 2=武器 3=衣服 4=腰带 5=裤子 6=鞋子 7=戒指 8=项链',
        enhancement_level INT DEFAULT 0 COMMENT '强化等级',
        enchantments TEXT COMMENT '附魔属性 (JSON格式)',
        status TINYINT DEFAULT 0 COMMENT '状态: 0=正常 1=删除',
        create_time INT NOT NULL,
        update_time INT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES item(id),
        FOREIGN KEY (uid) REFERENCES user(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ equipment表创建成功\n');

    // 检查装备表结构
    const [columns] = await query('SHOW COLUMNS FROM equipment');
    console.log('=== equipment表结构 ===');
    columns.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Comment || ''}`);
    });

    console.log('\n=== 操作完成 ===');
  } catch (error) {
    console.error('❌ 创建equipment表失败:', error.message);
  } finally {
    process.exit();
  }
}

createEquipmentTable();
