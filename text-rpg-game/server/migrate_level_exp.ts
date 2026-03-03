import { pool } from './src/config/db';

async function migrate() {
  try {
    console.log('开始创建经验表...');

    // 创建 level_exp 表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS level_exp (
        id INT PRIMARY KEY AUTO_INCREMENT,
        level INT NOT NULL UNIQUE,
        exp INT NOT NULL,
        create_time INT NOT NULL,
        update_time INT NOT NULL
      )
    `);
    console.log('✓ 创建 level_exp 表成功');

    // 插入初始经验数据（1-100级）
    const now = Math.floor(Date.now() / 1000);
    const levelExpData = [];
    
    for (let level = 1; level <= 100; level++) {
      const exp = Math.floor(100 * Math.pow(1.15, level - 1));
      levelExpData.push([level, exp, now, now]);
    }

    for (const data of levelExpData) {
      await pool.execute(
        'INSERT INTO level_exp (level, exp, create_time, update_time) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE exp = VALUES(exp), update_time = VALUES(update_time)',
        data
      );
    }
    console.log('✓ 插入经验数据成功（1-100级）');

    console.log('经验表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('经验表创建失败:', error);
    process.exit(1);
  }
}

migrate();