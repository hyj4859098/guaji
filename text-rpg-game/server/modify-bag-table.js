const mysql = require('mysql2/promise');

async function modifyBagTable() {
  console.log('=== 修改bag表结构 ===\n');

  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    // 检查并添加equipment_uid字段
    const [uidColumns] = await connection.execute('SHOW COLUMNS FROM bag WHERE Field = "equipment_uid"');
    if (uidColumns.length === 0) {
      await connection.execute(`
        ALTER TABLE bag ADD COLUMN equipment_uid VARCHAR(50) DEFAULT NULL COMMENT '装备唯一标识（关联equip表）'
      `);
      console.log('✅ 添加equipment_uid字段成功');
    } else {
      console.log('⚠️ equipment_uid字段已存在');
    }

    // 检查表结构
    console.log('\n=== 修改后的bag表结构 ===');
    const [columns] = await connection.execute('SHOW COLUMNS FROM bag');
    columns.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Comment || ''}`);
    });

    console.log('\n=== 操作完成 ===');
    await connection.end();
  } catch (error) {
    console.error('❌ 修改bag表失败:', error.message);
  }
}

modifyBagTable();
