const mysql = require('mysql2/promise');

async function testItems() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 物品表 ===\n');
    const [items] = await connection.execute('SELECT * FROM item');
    console.log(JSON.stringify(items, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

testItems();
