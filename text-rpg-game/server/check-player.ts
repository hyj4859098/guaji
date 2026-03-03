import { pool } from './src/config/db';

async function checkPlayerData() {
  try {
    console.log('检查现有玩家数据...');
    
    const rows = await pool.execute('SELECT id, name, level, hp, max_hp, mp, max_mp, gold, reputation FROM player');
    const players = rows[0] as any[];
    console.log('玩家数据:');
    console.table(players);
    
    // 如果有玩家但没有 mp/max_mp/reputation 值，更新它们
    if (players.length > 0) {
      for (const player of players) {
        if (player.mp === null || player.max_mp === null || player.reputation === null) {
          console.log(`更新玩家 ${player.name} 的数据...`);
          await pool.execute(
            'UPDATE player SET mp = COALESCE(mp, 50), max_mp = COALESCE(max_mp, 50), reputation = COALESCE(reputation, 0) WHERE id = ?',
            [player.id]
          );
          console.log(`✓ 玩家 ${player.name} 数据更新成功`);
        }
      }
    }
    
    console.log('\n更新后的玩家数据:');
    const updatedRows = await pool.execute('SELECT id, name, level, hp, max_hp, mp, max_mp, gold, reputation FROM player');
    console.table(updatedRows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkPlayerData();