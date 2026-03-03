const mysql = require('mysql2/promise');

async function checkBagRecords() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 检查用户4的背包记录 ===\n');
    
    const [bags] = await connection.execute('SELECT * FROM bag WHERE uid = 4');
    console.log('背包记录:');
    console.log(JSON.stringify(bags, null, 2));
    
    console.log('\n=== 检查装备记录 ===\n');
    
    const [equips] = await connection.execute('SELECT * FROM equip WHERE uid = 4 ORDER BY id DESC LIMIT 5');
    console.log('最新5件装备:');
    console.log(JSON.stringify(equips, null, 2));
    
    console.log('\n=== 检查装备基础属性 ===\n');
    
    const [equipBase] = await connection.execute('SELECT * FROM equip_base WHERE item_id = 14');
    console.log('新手戒基础属性:');
    console.log(JSON.stringify(equipBase, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

checkBagRecords();
