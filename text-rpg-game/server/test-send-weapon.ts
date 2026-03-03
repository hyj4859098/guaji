import { BagService } from './src/service/bag.service';

async function sendWeapon() {
  try {
    // 初始化背包服务
    const bagService = new BagService();
    
    // 假设用户ID为1（需要根据实际情况调整）
    const uid = 1;
    
    // 武器的物品ID（假设为1，需要根据实际情况调整）
    const weaponItemId = 1;
    
    // 发送一把武器
    await bagService.addItem(uid, weaponItemId, 1);
    
    console.log('武器发送成功！');
  } catch (error) {
    console.error('武器发送失败:', error);
  }
}

sendWeapon();
