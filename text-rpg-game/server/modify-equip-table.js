const mysql = require('mysql2/promise');

async function modifyEquipTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 修改 equip 表 ===\n');

  try {
    console.log('=== 步骤1: 检查 equip 表结构 ===');
    const [columns] = await connection.query('SHOW COLUMNS FROM equip');
    console.log('✅ equip 表当前字段:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    console.log('\n=== 步骤2: 添加装备属性字段 ===');
    
    const fieldsToAdd = [
      'hp INT DEFAULT 0 COMMENT "HP属性"',
      'phy_atk INT DEFAULT 0 COMMENT "物理攻击"',
      'phy_def INT DEFAULT 0 COMMENT "物理防御"',
      'mp INT DEFAULT 0 COMMENT "MP属性"',
      'mag_def INT DEFAULT 0 COMMENT "法术防御"',
      'mag_atk INT DEFAULT 0 COMMENT "法术攻击"'
    ];

    for (const fieldDef of fieldsToAdd) {
      const fieldName = fieldDef.split(' ')[0];
      const hasField = columns.some(col => col.Field === fieldName);
      
      if (!hasField) {
        await connection.query(`ALTER TABLE equip ADD COLUMN ${fieldDef}`);
        console.log(`✅ 添加字段: ${fieldName}`);
      } else {
        console.log(`✅ 字段已存在: ${fieldName}`);
      }
    }

    console.log('\n=== 步骤3: 验证 equip 表结构 ===');
    const [columnsAfter] = await connection.query('SHOW COLUMNS FROM equip');
    console.log('✅ equip 表最终字段:');
    columnsAfter.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    console.log('\n=== 修改完成 ===');
    console.log('💡 equip 表已添加装备属性字段');
    console.log('💡 每件装备都有自己的属性值');
    console.log('💡 属性值会根据基础属性进行浮动');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

modifyEquipTable();
