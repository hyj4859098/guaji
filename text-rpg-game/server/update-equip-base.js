const mysql = require('mysql2/promise');

async function updateEquipBase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 更新装备基础属性表 ===\n');
    
    const items = [
      { item_id: 1, name: '铁剑', pos: 2, main_attr: 'phy_atk', base_phy_atk: 10 },
      { item_id: 2, name: '皮甲', pos: 3, main_attr: 'phy_def', base_phy_def: 5 },
      { item_id: 3, name: '腰带', pos: 4, main_attr: 'mp', base_mp: 20 },
      { item_id: 4, name: '裤子', pos: 5, main_attr: 'mag_def', base_mag_def: 5 },
      { item_id: 5, name: '布鞋', pos: 6, main_attr: 'phy_def', base_phy_def: 3 },
      { item_id: 6, name: '新手戒', pos: 7, main_attr: 'phy_atk', base_phy_atk: 5 },
      { item_id: 7, name: '新手链', pos: 8, main_attr: 'mag_atk', base_mag_atk: 5 },
      { item_id: 8, name: '新手马', pos: 1, main_attr: 'hp', base_hp: 50 }
    ];
    
    for (const item of items) {
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
          item.item_id, item.pos, item.main_attr,
          item.base_hp || 0, item.base_mp || 0,
          item.base_phy_atk || 0, item.base_phy_def || 0,
          item.base_mag_def || 0, item.base_mag_atk || 0,
          now, now
        ]
      );
      console.log(`已更新装备基础属性: ${item.name} (item_id: ${item.item_id})`);
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

updateEquipBase();
