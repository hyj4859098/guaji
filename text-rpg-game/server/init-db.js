const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root123',
  database: 'text_rpg'
};

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  const sql = fs.readFileSync(path.join(__dirname, '../database.sql'), 'utf8');
  
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement) {
      try {
        await connection.execute(statement);
        console.log('✅ 执行成功:', statement.substring(0, 50));
      } catch (error) {
        console.error('❌ 执行失败:', error.message);
      }
    }
  }
  
  await connection.end();
  console.log('🎉 数据库初始化完成！');
}

initDatabase().catch(console.error);
