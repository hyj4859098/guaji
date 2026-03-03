const mysql = require('mysql2/promise');

async function createPlayerRecord() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });
  
  try {
    console.log('=== 检查用户4的player记录 ===\n');
    
    const [players] = await connection.execute('SELECT * FROM player WHERE uid = 4');
    console.log('玩家记录:', players.length > 0 ? '存在' : '不存在');
    
    if (players.length === 0) {
      console.log('\n=== 创建player记录 ===\n');
      const now = Math.floor(Date.now() / 1000);
      const [result] = await connection.execute(
        'INSERT INTO player (uid, name, hp, max_hp, level, exp, gold, phy_atk, mag_atk, phy_def, mag_def, hit_rate, dodge_rate, crit_rate, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [4, 'testuser', 100, 100, 1, 0, 100, 10, 5, 5, 3, 80, 10, 5, now, now]
      );
      console.log('player记录创建成功, ID:', result.insertId);
    }
    
    console.log('\n=== 检查player记录 ===\n');
    const [playerList] = await connection.execute('SELECT * FROM player WHERE uid = 4');
    console.log(JSON.stringify(playerList, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

createPlayerRecord();
