const fs = require('fs');
const mysql = require('mysql2/promise');

async function executeSqlFile() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 执行 SQL 脚本 ===\n');

  try {
    const sql = fs.readFileSync('./sql/create_equip_base.sql', 'utf8');
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
        console.log('✅ 执行成功:', statement.substring(0, 50) + '...');
      }
    }

    console.log('\n=== SQL 脚本执行完成 ===');

    console.log('\n=== 验证 equip_base 表 ===');
    const [rows] = await connection.query('SELECT * FROM equip_base');
    console.log(`✅ equip_base 表中有 ${rows.length} 条记录`);
    rows.forEach(row => {
      console.log(`  - item_id: ${row.item_id}, pos: ${row.pos}, main_attr: ${row.main_attr}`);
    });
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

executeSqlFile();
