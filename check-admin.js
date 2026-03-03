const { dataStorageService } = require('./text-rpg-game/server/dist/service/data-storage.service');

async function checkAdmin() {
  try {
    console.log('检查用户表...');
    
    // 获取所有用户
    const users = await dataStorageService.list('user');
    console.log('所有用户:', users);
    
    // 检查是否存在管理员账号
    const admin = await dataStorageService.getByCondition('user', { username: 'admin' });
    console.log('管理员账号:', admin);
    
    if (!admin) {
      console.log('没有找到管理员账号，正在创建...');
      // 创建管理员账号
      const adminId = await dataStorageService.insert('user', {
        username: 'admin',
        password: 'admin',
        is_admin: true,
        create_time: Math.floor(Date.now() / 1000),
        update_time: Math.floor(Date.now() / 1000)
      });
      console.log('管理员账号创建成功，ID:', adminId);
    } else {
      console.log('管理员账号已存在');
    }
  } catch (error) {
    console.error('检查管理员账号失败:', error);
  }
}

checkAdmin();