const mysql = require('mysql2/promise');

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 检查数据库数据 ===\n');

  try {
    const [users] = await connection.query('SELECT * FROM user');
    console.log(`用户表 (${users.length}条):`);
    users.forEach(user => {
      console.log(`  ID: ${user.id}, 用户名: ${user.username}, 状态: ${user.status}`);
    });

    const [players] = await connection.query('SELECT * FROM player');
    console.log(`\n玩家表 (${players.length}条):`);
    players.forEach(player => {
      console.log(`  ID: ${player.id}, UID: ${player.uid}, 名称: ${player.name}, 等级: ${player.level}`);
    });

    const [bags] = await connection.query('SELECT * FROM bag');
    console.log(`\n背包表 (${bags.length}条):`);
    bags.forEach(bag => {
      console.log(`  ID: ${bag.id}, UID: ${bag.uid}, 物品ID: ${bag.item_id}, 数量: ${bag.count}`);
    });

    const [equips] = await connection.query('SELECT * FROM equip');
    console.log(`\n装备表 (${equips.length}条):`);
    equips.forEach(equip => {
      console.log(`  ID: ${equip.id}, UID: ${equip.uid}, 物品ID: ${equip.item_id}, 位置: ${equip.pos}`);
    });

    console.log('\n=== 检查完成 ===\n');
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await connection.end();
  }
}

checkDatabase();
