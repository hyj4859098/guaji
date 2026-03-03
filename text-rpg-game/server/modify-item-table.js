const mysql = require('mysql2/promise');

async function modifyItemTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 修改 item 表 ===\n');

  try {
    console.log('=== 步骤1: 检查 item 表结构 ===');
    const [columns] = await connection.query('SHOW COLUMNS FROM item');
    const hasEffect = columns.some(col => col.Field === 'effect');
    
    if (hasEffect) {
      console.log('✅ item 表有 effect 字段，准备删除');
      
      console.log('\n=== 步骤2: 删除 effect 字段 ===');
      await connection.query('ALTER TABLE item DROP COLUMN effect');
      console.log('✅ effect 字段已删除');
    } else {
      console.log('✅ item 表没有 effect 字段');
    }

    console.log('\n=== 步骤3: 验证 item 表结构 ===');
    const [columnsAfter] = await connection.query('SHOW COLUMNS FROM item');
    console.log('✅ item 表字段:');
    columnsAfter.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    console.log('\n=== 修改完成 ===');
    console.log('💡 item 表已移除 effect 字段');
    console.log('💡 装备属性现在存储在 equip 表和 equip_base 表中');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

modifyItemTable();
