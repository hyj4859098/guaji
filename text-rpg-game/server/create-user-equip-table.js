const mysql = require('mysql2/promise');

async function createUserEquipTable() {
  console.log('=== 创建user_equip表（用户装备栏） ===\n');

  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    // 创建user_equip表（用户装备栏）
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_equip (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid INT NOT NULL,
        equipment_uid VARCHAR(50) NOT NULL,
        pos TINYINT DEFAULT 0 COMMENT '装备位置: 0=无 1=坐骑 2=武器 3=衣服 4=腰带 5=裤子 6=鞋子 7=戒指 8=项链',
        status TINYINT DEFAULT 0 COMMENT '状态: 0=正常 1=删除',
        create_time INT NOT NULL,
        update_time INT NOT NULL,
        FOREIGN KEY (uid) REFERENCES user(id),
        FOREIGN KEY (equipment_uid) REFERENCES equip(equipment_uid),
        UNIQUE KEY unique_pos (uid, pos) COMMENT '每个位置只能穿戴一件装备'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ user_equip表创建成功\n');

    // 检查表结构
    const [columns] = await connection.execute('SHOW COLUMNS FROM user_equip');
    console.log('=== user_equip表结构 ===');
    columns.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Comment || ''}`);
    });

    console.log('\n=== 操作完成 ===');
    await connection.end();
  } catch (error) {
    console.error('❌ 创建user_equip表失败:', error.message);
  }
}

createUserEquipTable();
