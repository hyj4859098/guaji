const mysql = require('mysql2/promise');

async function updateAllEquipBase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 获取所有装备物品 ===\n');
    
    const [items] = await connection.execute('SELECT id, name, pos FROM item WHERE type = 2');
    console.log('装备物品列表:');
    console.log(JSON.stringify(items, null, 2));
    
    const equipBaseMap = {
      1: { name: '铁剑', pos: 2, main_attr: 'phy_atk', base_phy_atk: 10 },
      2: { name: '皮甲', pos: 3, main_attr: 'phy_def', base_phy_def: 5 },
      3: { name: '腰带', pos: 4, main_attr: 'mp', base_mp: 20 },
      4: { name: '裤子', pos: 5, main_attr: 'mag_def', base_mag_def: 5 },
      5: { name: '布鞋', pos: 6, main_attr: 'phy_def', base_phy_def: 3 },
      6: { name: '铁剑', pos: 2, main_attr: 'phy_atk', base_phy_atk: 10 },
      7: { name: '皮甲', pos: 3, main_attr: 'phy_def', base_phy_def: 5 },
      8: { name: '布鞋', pos: 6, main_attr: 'phy_def', base_phy_def: 3 },
      14: { name: '新手戒', pos: 7, main_attr: 'phy_atk', base_phy_atk: 5 },
      15: { name: '新手链', pos: 8, main_attr: 'mag_atk', base_mag_atk: 5 },
      16: { name: '新手马', pos: 1, main_attr: 'hp', base_hp: 50 }
    };
    
    console.log('\n=== 更新装备基础属性表 ===\n');
    
    for (const item of items) {
      const baseData = equipBaseMap[item.id];
      if (!baseData) {
        console.log(`跳过未知装备: ${item.name} (item_id: ${item.id})`);
        continue;
      }
      
      const now = Math.floor(Date.now() / 1000);
      await connection.execute(
        `INSERT INTO equip_base (item_id, pos, main_attr, base_hp, base_mp, base_phy_atk, base_phy_def, base_mag_def, base_mag_atk, create_time, update_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         pos = VALUES(pos), main_attr = VALUES(main_attr), 
         base_hp = VALUES(base_hp), base_mp = VALUES(base_mp), 
         base_phy_atk = VALUES(base_phy_atk), base_phy_def = VALUES(base_phy_def), 
         base_mag_def = VALUES(base_mag_def), base_mag_atk = VALUES(base_mag_atk), 
         update_time = VALUES(update_time)`,
        [
          item.id, baseData.pos, baseData.main_attr,
          baseData.base_hp || 0, baseData.base_mp || 0,
          baseData.base_phy_atk || 0, baseData.base_phy_def || 0,
          baseData.base_mag_def || 0, baseData.base_mag_atk || 0,
          now, now
        ]
      );
      console.log(`已更新装备基础属性: ${item.name} (item_id: ${item.id})`);
    }
    
    console.log('\n=== 验证更新结果 ===\n');
    const [equipBase] = await connection.execute('SELECT * FROM equip_base');
    console.log(JSON.stringify(equipBase, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

updateAllEquipBase();
