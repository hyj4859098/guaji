const mysql = require('mysql2/promise');

async function updateItemTypeComment() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 更新物品表类型注释 ===\n');

  try {
    // 更新物品表类型字段的注释
    await connection.query(`
      ALTER TABLE item MODIFY COLUMN type TINYINT NOT NULL COMMENT '1=消耗品 2=装备 3=材料 4=道具'
    `);
    console.log('✅ 物品表类型注释更新成功');

    // 测试查询物品表结构
    const [result] = await connection.query('SHOW FULL COLUMNS FROM item WHERE Field = "type"');
    console.log('\n=== 物品表类型字段信息 ===');
    console.log(`字段名: ${result[0].Field}`);
    console.log(`类型: ${result[0].Type}`);
    console.log(`注释: ${result[0].Comment}`);

    console.log('\n=== 更新完成 ===');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

updateItemTypeComment();
