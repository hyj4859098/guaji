const mysql = require('mysql2/promise');

async function testDbConnection() {
  console.log('Testing database connection...');
  
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'root123',
      database: 'text_rpg',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // 测试连接
    const [rows] = await pool.execute('SELECT 1 + 1 as result');
    console.log('Database connection successful:', rows);
    
    // 测试查询玩家表
    const [players] = await pool.execute('SELECT * FROM player LIMIT 5');
    console.log('Player table query result:', players);
    
    // 测试查询背包表
    const [bags] = await pool.execute('SELECT * FROM bag LIMIT 5');
    console.log('Bag table query result:', bags);
    
    pool.end();
    console.log('Database connection test completed successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testDbConnection();