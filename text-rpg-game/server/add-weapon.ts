import { query } from './src/config/db';
import { BagService } from './src/service/bag.service';

async function addWeaponToUser(username: string, weaponId: number, count: number) {
  try {
    // 查询用户ID
    const users = await query('SELECT id FROM user WHERE username = ?', [username]);
    if (users.length === 0) {
      console.log(`用户 ${username} 不存在`);
      return;
    }
    
    const uid = users[0].id;
    console.log(`找到用户 ${username}，UID: ${uid}`);
    
    // 添加武器到背包
    const bagService = new BagService();
    await bagService.addItem(uid, weaponId, count);
    
    console.log(`成功添加武器到用户 ${username} 的背包`);
  } catch (error) {
    console.error('添加武器失败:', error);
  }
}

// 运行脚本
addWeaponToUser('asd4859098', 6, 1); // 武器ID为6（新手剑），数量为1
