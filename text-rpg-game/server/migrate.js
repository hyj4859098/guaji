import { pool } from './src/config/db.js';

async function migrate() {
  try {
    console.log('开始数据库迁移...');

    // 添加 mp 字段
    await pool.execute('ALTER TABLE player ADD COLUMN mp INT DEFAULT 50');
    console.log('✓ 添加 mp 字段成功');

    // 添加 max_mp 字段
    await pool.execute('ALTER TABLE player ADD COLUMN max_mp INT DEFAULT 50');
    console.log('✓ 添加 max_mp 字段成功');

    // 添加 reputation 字段
    await pool.execute('ALTER TABLE player ADD COLUMN reputation INT DEFAULT 0');
    console.log('✓ 添加 reputation 字段成功');

    console.log('数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

migrate();