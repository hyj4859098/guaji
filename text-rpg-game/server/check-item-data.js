const mysql = require('mysql2/promise');

async function checkItemData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 检查物品数据 ===\n');

  try {
    // 检查物品表
    const [items] = await connection.query('SELECT * FROM item');
    console.log(`物品表 (${items.length}条):`);
    items.forEach(item => {
      console.log(`  ID: ${item.id}, 名称: ${item.name}, 类型: ${item.type}`);
    });

    // 检查背包表
    const [bags] = await connection.query('SELECT * FROM bag');
    console.log(`\n背包表 (${bags.length}条):`);
    bags.forEach(bag => {
      console.log(`  ID: ${bag.id}, 物品ID: ${bag.item_id}, 数量: ${bag.count}`);
    });

    // 测试关联查询
    console.log('\n=== 测试关联查询 ===');
    const [joined] = await connection.query(`
      SELECT b.*, i.name as item_name 
      FROM bag b 
      LEFT JOIN item i ON b.item_id = i.id 
      WHERE b.status = 0
    `);
    console.log(`关联查询结果 (${joined.length}条):`);
    joined.forEach(row => {
      console.log(`  背包ID: ${row.id}, 物品ID: ${row.item_id}, 物品名称: ${row.item_name || '未知'}, 数量: ${row.count}`);
    });

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await connection.end();
  }
}

checkItemData();
