const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库连接配置
const config = {
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'text_rpg'
};

async function migrate() {
  let connection;
  try {
    // 连接数据库
    connection = await mysql.createConnection(config);
    console.log('Connected to database');

    // 执行创建地图表
    console.log('Creating map table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`map\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`name\` VARCHAR(50) NOT NULL,
        \`create_time\` INT NOT NULL,
        \`update_time\` INT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('Map table created successfully');

    // 执行添加map_id字段
    console.log('Adding map_id column to monster table...');
    await connection.execute(`
      ALTER TABLE \`monster\` ADD COLUMN \`map_id\` INT NOT NULL DEFAULT 1 AFTER \`reputation\`
    `);
    console.log('map_id column added successfully');

    // 执行添加索引
    console.log('Adding index to map_id...');
    await connection.execute(`
      ALTER TABLE \`monster\` ADD INDEX \`idx_map_id\` (\`map_id\`)
    `);
    console.log('Index added successfully');

    // 执行插入初始地图数据
    console.log('Inserting initial map data...');
    await connection.execute(`
      INSERT INTO \`map\` (\`name\`, \`create_time\`, \`update_time\`) VALUES
      ('新手村', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
      ('森林', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
      ('沙漠', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
      ('雪山', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
      ('地宫', UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
    `);
    console.log('Initial map data inserted successfully');

    // 执行更新现有怪物的map_id
    console.log('Updating existing monsters\' map_id...');
    await connection.execute(`
      UPDATE \`monster\` SET \`map_id\` = 1
    `);
    console.log('Monsters\' map_id updated successfully');

    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // 关闭连接
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// 运行迁移
migrate();
