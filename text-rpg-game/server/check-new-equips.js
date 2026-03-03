const mysql = require('mysql2/promise');

async function checkNewEquips() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 检查最新装备记录 ===\n');
    
    const [equips] = await connection.execute('SELECT * FROM equip WHERE uid = 4 ORDER BY id DESC LIMIT 10');
    console.log('用户4的最新装备记录:');
    console.log(JSON.stringify(equips, null, 2));
    
    console.log('\n=== 检查背包记录 ===\n');
    const [bags] = await connection.execute('SELECT * FROM bag WHERE uid = 4 AND item_id = 6 ORDER BY id DESC LIMIT 5');
    console.log('用户4的装备背包记录:');
    console.log(JSON.stringify(bags, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

checkNewEquips();
