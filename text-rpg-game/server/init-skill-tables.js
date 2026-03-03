const mysql = require('mysql2/promise');

async function initSkillTables() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('数据库连接成功');

    // 读取并执行 SQL 文件
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./sql/create_skill_tables.sql', 'utf8');
    
    // 分割 SQL 语句并执行
    const sqlStatements = sqlContent.split(';').filter(statement => statement.trim() !== '');
    
    for (const statement of sqlStatements) {
      await connection.execute(statement);
      console.log('执行 SQL 语句成功');
    }

    console.log('技能表初始化完成');
    await connection.end();
  } catch (error) {
    console.error('初始化技能表失败:', error);
  }
}

initSkillTables();
