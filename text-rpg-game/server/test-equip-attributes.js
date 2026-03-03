const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function testEquipAttributes() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 测试装备属性系统 ===\n');
    
    const [equips] = await connection.execute('SELECT * FROM equip ORDER BY id DESC LIMIT 5');
    console.log('最近5件装备记录:');
    console.log(JSON.stringify(equips, null, 2));
    
    console.log('\n=== 装备基础属性表 ===\n');
    const [equipBase] = await connection.execute('SELECT * FROM equip_base');
    console.log(JSON.stringify(equipBase, null, 2));
    
    console.log('\n=== 背包物品 ===\n');
    const [bags] = await connection.execute('SELECT * FROM bag ORDER BY id DESC LIMIT 5');
    console.log(JSON.stringify(bags, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

testEquipAttributes();
