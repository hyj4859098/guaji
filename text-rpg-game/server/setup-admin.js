const mysql = require('mysql2/promise');
const config = {
  db: {
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  }
};

async function setupAdmin() {
  let connection;
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database
    });

    console.log('Connected to database');

    // 步骤1: 添加is_admin字段
    try {
      await connection.execute(
        'ALTER TABLE user ADD COLUMN is_admin TINYINT DEFAULT 0 COMMENT \'是否为管理员 0=否 1=是\''
      );
      console.log('Added is_admin column to user table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('is_admin column already exists, skipping');
      } else {
        throw error;
      }
    }

    // 步骤2: 将用户asd4859098设为管理员
    const [result] = await connection.execute(
      'UPDATE user SET is_admin = 1 WHERE username = ?',
      ['asd4859098']
    );

    if (result.affectedRows > 0) {
      console.log('Successfully set user asd4859098 as admin');
    } else {
      console.log('User asd4859098 not found, creating user...');
      
      // 如果用户不存在，创建用户
      await connection.execute(
        'INSERT INTO user (username, password, create_time, update_time, is_admin) VALUES (?, ?, NOW(), NOW(), 1)',
        ['asd4859098', '123456']
      );
      console.log('Created user asd4859098 with admin privileges');
    }

    // 步骤3: 查看修改结果
    const [rows] = await connection.execute(
      'SELECT id, username, is_admin FROM user WHERE username = ?',
      ['asd4859098']
    );

    console.log('\nAdmin setup result:');
    console.log(rows);

  } catch (error) {
    console.error('Error setting up admin:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

setupAdmin();
