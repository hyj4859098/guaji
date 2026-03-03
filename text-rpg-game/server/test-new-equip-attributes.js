const mysql = require('mysql2/promise');

async function testNewEquipAttributes() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 测试新装备属性系统 ===\n');
    
    console.log('1. 添加一把新铁剑到背包');
    const now = Math.floor(Date.now() / 1000);
    
    const equipment_uid = `EQP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    const equipBase = await connection.execute(
      'SELECT * FROM equip_base WHERE item_id = 6',
      []
    );
    
    if (equipBase[0].length === 0) {
      console.log('装备基础属性不存在');
      return;
    }
    
    const base = equipBase[0][0];
    console.log('装备基础属性:', base);
    
    const equipData = {
      uid: 4,
      item_id: 6,
      pos: base.pos,
      equipment_uid: equipment_uid,
      level: base.base_level,
      enhancement_level: 0,
      enchantments: null,
      hp: Math.floor(base.base_hp * (0.8 + Math.random() * 0.4)),
      phy_atk: Math.floor(base.base_phy_atk * (0.8 + Math.random() * 0.4)),
      phy_def: Math.floor(base.base_phy_def * (0.8 + Math.random() * 0.4)),
      mp: Math.floor(base.base_mp * (0.8 + Math.random() * 0.4)),
      mag_def: Math.floor(base.base_mag_def * (0.8 + Math.random() * 0.4)),
      mag_atk: Math.floor(base.base_mag_atk * (0.8 + Math.random() * 0.4)),
      hit_rate: Math.floor(base.base_hit_rate * (0.8 + Math.random() * 0.4)),
      dodge_rate: Math.floor(base.base_dodge_rate * (0.8 + Math.random() * 0.4)),
      crit_rate: Math.floor(base.base_crit_rate * (0.8 + Math.random() * 0.4))
    };
    
    console.log('生成的装备属性:', equipData);
    
    const equipResult = await connection.execute(
      'INSERT INTO equip (uid, item_id, pos, equipment_uid, level, enhancement_level, enchantments, hp, phy_atk, phy_def, mp, mag_def, mag_atk, hit_rate, dodge_rate, crit_rate, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        equipData.uid,
        equipData.item_id,
        equipData.pos,
        equipData.equipment_uid,
        equipData.level,
        equipData.enhancement_level,
        equipData.enchantments,
        equipData.hp,
        equipData.phy_atk,
        equipData.phy_def,
        equipData.mp,
        equipData.mag_def,
        equipData.mag_atk,
        equipData.hit_rate,
        equipData.dodge_rate,
        equipData.crit_rate,
        now,
        now
      ]
    );
    
    console.log('装备创建成功，ID:', equipResult[0].insertId);
    
    await connection.execute(
      'INSERT INTO bag (uid, item_id, count, equipment_uid, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
      [4, 6, 1, equipment_uid, now, now]
    );
    
    console.log('装备已添加到背包');
    
    console.log('\n2. 检查装备详情');
    const equipDetails = await connection.execute(
      'SELECT * FROM equip WHERE equipment_uid = ?',
      [equipment_uid]
    );
    console.log('装备详情:', JSON.stringify(equipDetails[0][0], null, 2));
    
    console.log('\n3. 检查背包');
    const bags = await connection.execute(
      'SELECT * FROM bag WHERE uid = 4',
      []
    );
    console.log('背包物品:', JSON.stringify(bags[0], null, 2));
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

testNewEquipAttributes();
