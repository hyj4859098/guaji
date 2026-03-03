import { pool } from './src/config/db';

async function verify() {
  try {
    console.log('验证数据库表结构...');
    
    const [rows] = await pool.execute('DESCRIBE player');
    console.log('player 表结构:');
    console.table(rows);
    
    process.exit(0);
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  }
}

verify();