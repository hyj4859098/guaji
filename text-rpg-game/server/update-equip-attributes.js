const mysql = require('mysql2/promise');

async function updateEquipTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 修改 equip 表结构 ===\n');
    
    await connection.execute(`
      ALTER TABLE equip 
      ADD COLUMN level INT DEFAULT 1 COMMENT '装备等级' AFTER equipment_uid,
      ADD COLUMN hit_rate INT DEFAULT 0 COMMENT '命中率' AFTER mag_atk,
      ADD COLUMN dodge_rate INT DEFAULT 0 COMMENT '闪避率' AFTER hit_rate,
      ADD COLUMN crit_rate INT DEFAULT 0 COMMENT '暴击率' AFTER dodge_rate
    `);
    console.log('equip 表结构修改成功');
    
    console.log('\n=== 修改 equip_base 表结构 ===\n');
    
    await connection.execute(`
      ALTER TABLE equip_base 
      ADD COLUMN base_level INT DEFAULT 1 COMMENT '基础等级' AFTER main_attr,
      ADD COLUMN base_hit_rate INT DEFAULT 0 COMMENT '基础命中率' AFTER base_mag_atk,
      ADD COLUMN base_dodge_rate INT DEFAULT 0 COMMENT '基础闪避率' AFTER base_hit_rate,
      ADD COLUMN base_crit_rate INT DEFAULT 0 COMMENT '基础暴击率' AFTER base_dodge_rate
    `);
    console.log('equip_base 表结构修改成功');
    
    console.log('\n=== 更新装备基础属性数据 ===\n');
    
    const equipBaseMap = {
      1: { name: '铁剑', pos: 2, main_attr: 'phy_atk', base_level: 1, base_phy_atk: 10, base_hit_rate: 2, base_dodge_rate: 0, base_crit_rate: 1 },
      2: { name: '皮甲', pos: 3, main_attr: 'phy_def', base_level: 1, base_phy_def: 5, base_hit_rate: 0, base_dodge_rate: 1, base_crit_rate: 0 },
      3: { name: '腰带', pos: 4, main_attr: 'mp', base_level: 1, base_mp: 20, base_hit_rate: 0, base_dodge_rate: 0, base_crit_rate: 0 },
      4: { name: '裤子', pos: 5, main_attr: 'mag_def', base_level: 1, base_mag_def: 5, base_hit_rate: 0, base_dodge_rate: 0, base_crit_rate: 0 },
      5: { name: '布鞋', pos: 6, main_attr: 'phy_def', base_level: 1, base_phy_def: 3, base_hit_rate: 0, base_dodge_rate: 2, base_crit_rate: 0 },
      6: { name: '铁剑', pos: 2, main_attr: 'phy_atk', base_level: 1, base_phy_atk: 10, base_hit_rate: 2, base_dodge_rate: 0, base_crit_rate: 1 },
      7: { name: '皮甲', pos: 3, main_attr: 'phy_def', base_level: 1, base_phy_def: 5, base_hit_rate: 0, base_dodge_rate: 1, base_crit_rate: 0 },
      8: { name: '布鞋', pos: 6, main_attr: 'phy_def', base_level: 1, base_phy_def: 3, base_hit_rate: 0, base_dodge_rate: 2, base_crit_rate: 0 },
      14: { name: '新手戒', pos: 7, main_attr: 'phy_atk', base_level: 1, base_phy_atk: 5, base_hit_rate: 1, base_dodge_rate: 0, base_crit_rate: 1 },
      15: { name: '新手链', pos: 8, main_attr: 'mag_atk', base_level: 1, base_mag_atk: 5, base_hit_rate: 0, base_dodge_rate: 0, base_crit_rate: 1 },
      16: { name: '新手马', pos: 1, main_attr: 'hp', base_level: 1, base_hp: 50, base_hit_rate: 0, base_dodge_rate: 0, base_crit_rate: 0 }
    };
    
    const now = Math.floor(Date.now() / 1000);
    
    for (const [itemId, baseData] of Object.entries(equipBaseMap)) {
      await connection.execute(
        `UPDATE equip_base 
         SET base_level = ?, base_hit_rate = ?, base_dodge_rate = ?, base_crit_rate = ?,
             update_time = ?
         WHERE item_id = ?`,
        [
          baseData.base_level,
          baseData.base_hit_rate,
          baseData.base_dodge_rate,
          baseData.base_crit_rate,
          now,
          parseInt(itemId)
        ]
      );
      console.log(`已更新装备基础属性: ${baseData.name} (item_id: ${itemId})`);
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

updateEquipTables();
