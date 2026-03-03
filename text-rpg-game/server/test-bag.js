const mysql = require('mysql2/promise');

async function testBagAPI() {
  // 测试Bag API
  console.log('=== 测试Bag API ===\n');

  try {
    // 先获取一个用户ID
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    const [users] = await connection.query('SELECT * FROM user');
    if (users.length === 0) {
      console.log('没有用户数据');
      return;
    }

    const userId = users[0].id;
    console.log(`测试用户ID: ${userId}`);

    // 测试添加背包物品
    console.log('\n1. 测试添加背包物品...');
    const addResult = await connection.query(
      'INSERT INTO bag (uid, item_id, count, status, create_time, update_time) VALUES (?, ?, ?, 0, ?, ?)',
      [userId, 1, 5, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
    );
    console.log('添加物品成功，ID:', addResult[0].insertId);

    // 测试获取背包列表
    console.log('\n2. 测试获取背包列表...');
    const [bags] = await connection.query('SELECT * FROM bag WHERE uid = ? AND status = 0', [userId]);
    console.log('背包物品数量:', bags.length);
    bags.forEach(item => {
      console.log(`  ID: ${item.id}, 物品ID: ${item.item_id}, 数量: ${item.count}`);
    });

    await connection.end();
    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('错误:', error.message);
  }
}

testBagAPI();
