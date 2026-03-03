import { query } from './src/config/db';

async function checkItems() {
  try {
    // 查询所有物品
    const items = await query('SELECT id, name, type FROM item');
    console.log('物品列表:');
    items.forEach((item: any) => {
      console.log(`ID: ${item.id}, 名称: ${item.name}, 类型: ${item.type}`);
    });
  } catch (error) {
    console.error('查询物品失败:', error);
  }
}

// 运行脚本
checkItems();
