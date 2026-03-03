const mysql = require('mysql2/promise');

async function checkUserEquipTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 检查user_equip表结构 ===\n');
    
    const [rows] = await connection.execute('SHOW CREATE TABLE user_equip');
    console.log(rows[0]['Create Table']);
    
    console.log('\n=== 检查user_equip表记录 ===\n');
    
    const [userEquips] = await connection.execute('SELECT * FROM user_equip WHERE uid = 4');
    console.log(JSON.stringify(userEquips, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

checkUserEquipTable();
