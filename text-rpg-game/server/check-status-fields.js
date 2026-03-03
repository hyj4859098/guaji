const mysql = require('mysql2/promise');

async function checkStatusFields() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 检查数据库表中的 status 字段 ===\n');

  try {
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    console.log(`找到 ${tableNames.length} 张表\n`);

    const tablesWithStatus = [];

    for (const tableName of tableNames) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
      const hasStatus = columns.some(col => col.Field === 'status');

      if (hasStatus) {
        tablesWithStatus.push(tableName);
        console.log(`✅ 表 ${tableName} 有 status 字段`);
      }
    }

    console.log(`\n=== 总结 ===`);
    console.log(`共有 ${tablesWithStatus.length} 张表有 status 字段`);
    console.log(`需要删除 status 字段的表: ${tablesWithStatus.join(', ')}`);

    console.log(`\n=== 开始删除 status 字段 ===`);
    for (const tableName of tablesWithStatus) {
      try {
        await connection.query(`ALTER TABLE ${tableName} DROP COLUMN status`);
        console.log(`✅ 表 ${tableName} 的 status 字段已删除`);
      } catch (error) {
        console.error(`❌ 表 ${tableName} 的 status 字段删除失败: ${error.message}`);
      }
    }

    console.log(`\n=== 删除完成 ===`);
    console.log(`💡 所有 status 字段已删除`);
    console.log(`💡 现在需要修改代码，移除对 status 字段的引用`);
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

checkStatusFields();
