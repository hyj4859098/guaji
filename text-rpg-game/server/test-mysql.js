const mysql = require('mysql2/promise');

async function testConnection() {
  const configs = [
    { host: 'localhost', port: 3306, user: 'root', password: '' },
    { host: 'localhost', port: 3306, user: 'root', password: 'root123' },
    { host: 'localhost', port: 3306, user: 'root', password: 'password' },
    { host: '127.0.0.1', port: 3306, user: 'root', password: '' },
    { host: '127.0.0.1', port: 3306, user: 'root', password: 'root123' },
  ];

  console.log('开始测试MySQL连接...\n');

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    console.log(`\n测试配置 ${i + 1}:`);
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  User: ${config.user}`);
    console.log(`  Password: ${config.password || '(空)'}`);

    try {
      const connection = await mysql.createConnection(config);
      console.log(`  ✅ 连接成功！`);
      
      await connection.query('SELECT DATABASE()');
      const [databases] = await connection.query('SHOW DATABASES');
      console.log(`  数据库列表: ${databases.map(d => d.Database).join(', ')}`);
      
      await connection.end();
      console.log(`  连接已关闭\n`);
      return config;
    } catch (error) {
      console.log(`  ❌ 连接失败: ${error.message}`);
      console.log(`  错误代码: ${error.code}\n`);
    }
  }

  console.log('\n所有配置测试完成！\n');
}

testConnection();
