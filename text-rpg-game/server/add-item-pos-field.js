const mysql = require('mysql2/promise');

async function addItemPosField() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 为物品表添加装备位置字段 ===\n');

  try {
    // 检查物品表是否已存在pos字段
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM item WHERE Field = 'pos'
    `);
    
    if (columns.length === 0) {
      // 为物品表添加pos字段
      await connection.query(`
        ALTER TABLE item ADD COLUMN pos TINYINT DEFAULT 0 COMMENT '装备位置: 0=无 1=坐骑 2=武器 3=衣服 4=腰带 5=裤子 6=鞋子 7=戒指 8=项链'
      `);
      console.log('✅ 物品表添加pos字段成功');
    } else {
      console.log('✅ 物品表pos字段已存在');
    }

    // 更新现有装备的pos字段
    await connection.query(`UPDATE item SET pos = 2 WHERE id = 6`); // 铁剑 -> 武器
    await connection.query(`UPDATE item SET pos = 3 WHERE id = 7`); // 皮甲 -> 衣服
    await connection.query(`UPDATE item SET pos = 6 WHERE id = 8`); // 布鞋 -> 鞋子
    console.log('✅ 现有装备位置更新成功');

    // 查看更新后的物品表
    const [items] = await connection.query('SELECT id, name, type, pos FROM item WHERE type = 2');
    console.log('\n装备位置更新结果:');
    items.forEach(item => {
      console.log(`  ID: ${item.id}, 名称: ${item.name}, 位置: ${item.pos}`);
    });

    console.log('\n=== 操作完成 ===');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

addItemPosField();
