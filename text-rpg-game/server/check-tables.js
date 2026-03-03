const mysql = require('mysql2/promise');

async function checkUserTable() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 检查user表结构
    console.log('\n=== 检查user表结构 ===');
    const [userStructure] = await connection.execute('DESCRIBE user');
    console.log('user表字段:', userStructure.map(field => field.Field));

    // 检查user表数据
    console.log('\n=== 检查user表数据 ===');
    const [users] = await connection.execute('SELECT * FROM user LIMIT 5');
    console.log('用户列表:', users);

    // 检查player表结构
    console.log('\n=== 检查player表结构 ===');
    const [playerStructure] = await connection.execute('DESCRIBE player');
    console.log('player表字段:', playerStructure.map(field => field.Field));

    // 检查player表数据
    console.log('\n=== 检查player表数据 ===');
    const [players] = await connection.execute('SELECT * FROM player LIMIT 5');
    console.log('玩家列表:', players);

    // 关闭连接
    await connection.end();
    console.log('\n✅ 测试完成，连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

checkUserTable();
