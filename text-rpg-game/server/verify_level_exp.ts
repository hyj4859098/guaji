import { pool } from './src/config/db';

async function verify() {
  try {
    console.log('验证经验表数据...');
    
    const rows = await pool.execute('SELECT * FROM level_exp ORDER BY level ASC LIMIT 10');
    const levelExps = rows[0] as any[];
    console.log('前10级经验配置:');
    console.table(levelExps);
    
    console.log('\n每10级经验配置:');
    const sampleRows = await pool.execute('SELECT * FROM level_exp WHERE level IN (1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100) ORDER BY level ASC');
    console.table(sampleRows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  }
}

verify();