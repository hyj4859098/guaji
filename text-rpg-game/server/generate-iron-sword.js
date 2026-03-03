const mysql = require('mysql2/promise');

async function generateIronSword() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 生成铁剑装备 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    const [items] = await connection.query('SELECT * FROM item WHERE name = ? AND status = 0', ['铁剑']);
    if (items.length === 0) {
      console.log('❌ 没有找到铁剑物品');
      return;
    }
    const item = items[0];
    console.log(`✅ 找到物品: ${item.name} (id: ${item.id}, 效果: ${item.effect})`);

    const equipment_uid = `EQP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const now = Math.floor(Date.now() / 1000);

    console.log('\n=== 步骤1: 创建装备记录到equip表 ===');
    const [equipResult] = await connection.query(
      'INSERT INTO equip (uid, item_id, pos, equipment_uid, enhancement_level, enchantments, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [uid, item.id, 2, equipment_uid, 0, null, now, now]
    );
    const equipId = equipResult.insertId;
    console.log(`✅ 装备记录创建成功 (equip_id: ${equipId}, equipment_uid: ${equipment_uid})`);

    console.log('\n=== 步骤2: 添加到背包表 ===');
    const [bagCheck] = await connection.query('SELECT * FROM bag WHERE uid = ? AND item_id = ? AND status = 0', [uid, item.id]);
    if (bagCheck.length > 0) {
      await connection.query('UPDATE bag SET count = count + 1, update_time = ? WHERE id = ?', [now, bagCheck[0].id]);
      console.log(`✅ 背包物品数量更新 (bag_id: ${bagCheck[0].id}, 数量: ${bagCheck[0].count + 1})`);
    } else {
      const [bagResult] = await connection.query(
        'INSERT INTO bag (uid, item_id, count, status, create_time, update_time) VALUES (?, ?, 1, 0, ?, ?)',
        [uid, item.id, now, now]
      );
      console.log(`✅ 背包物品添加成功 (bag_id: ${bagResult.insertId})`);
    }

    console.log('\n=== 步骤3: 查询玩家当前属性 ===');
    const [players] = await connection.query('SELECT * FROM player WHERE uid = ?', [uid]);
    if (players.length > 0) {
      const player = players[0];
      console.log(`等级: ${player.level}`);
      console.log(`生命值: ${player.hp}/${player.max_hp}`);
      console.log(`物理攻击: ${player.phy_atk}`);
      console.log(`物理防御: ${player.phy_def}`);
      console.log(`魔法攻击: ${player.mag_atk}`);
      console.log(`魔法防御: ${player.mag_def}`);
      console.log(`命中率: ${player.hit_rate}%`);
      console.log(`闪避率: ${player.dodge_rate}%`);
      console.log(`暴击率: ${player.crit_rate}%`);
      console.log(`金币: ${player.gold}`);
    }

    console.log('\n=== 步骤4: 查询当前装备栏（user_equip表） ===');
    const [userEquips] = await connection.query(
      'SELECT ue.*, e.*, i.name as item_name, i.effect as item_effect FROM user_equip ue ' +
      'JOIN equip e ON ue.equipment_uid = e.equipment_uid ' +
      'JOIN item i ON e.item_id = i.id ' +
      'WHERE ue.uid = ? AND ue.status = 0',
      [uid]
    );

    if (userEquips.length === 0) {
      console.log('（空）');
    } else {
      const posNames = {
        1: '坐骑',
        2: '武器',
        3: '衣服',
        4: '腰带',
        5: '裤子',
        6: '鞋子',
        7: '戒指',
        8: '项链'
      };
      userEquips.forEach(equip => {
        console.log(`${posNames[equip.pos] || equip.pos}: ${equip.item_name} (UID: ${equip.equipment_uid})`);
      });
    }

    console.log('\n=== 装备系统说明 ===');
    console.log('1. equip表: 存储每件装备的明细记录（身份证），包含UID、强化等级、附魔等');
    console.log('2. user_equip表: 用户装备在身上的装备栏，通过equipment_uid关联到equip表');
    console.log('3. bag表: 用户背包内的物品，通过item_id关联到item表');

    console.log('\n=== 铁剑装备信息 ===');
    console.log(`装备名称: 铁剑`);
    console.log(`装备位置: 武器 (pos: 2)`);
    console.log(`装备效果: 物理攻击 +20`);
    console.log(`装备UID: ${equipment_uid}`);
    console.log(`强化等级: 0`);
    console.log(`附魔: 无`);

    console.log('\n=== 生成完成 ===');
    console.log('💡 提示: 你现在可以在背包中看到铁剑，点击"装备"按钮即可穿戴');
    console.log('💡 穿戴后，装备会出现在user_equip表中，并且玩家属性会增加');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

generateIronSword();
