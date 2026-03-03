const mysql = require('mysql2/promise');

async function checkPlayerAndEquip() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 检查玩家属性 ===\n');
    
    const [players] = await connection.execute('SELECT * FROM player WHERE uid = 4');
    console.log('玩家属性:');
    console.log(JSON.stringify(players, null, 2));
    
    console.log('\n=== 检查已穿戴装备 ===\n');
    
    const [userEquips] = await connection.execute('SELECT ue.*, e.* FROM user_equip ue JOIN equip e ON ue.equipment_uid = e.equipment_uid WHERE ue.uid = 4');
    console.log('已穿戴装备:');
    console.log(JSON.stringify(userEquips, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

checkPlayerAndEquip();
