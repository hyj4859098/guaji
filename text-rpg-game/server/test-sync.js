const RedisService = require('./dist/service/redis.service').RedisService;

async function testSync() {
  console.log('开始测试数据同步功能...');
  
  // 测试同步单个玩家数据（这个方法是公有的）
  console.log('正在同步单个玩家数据...');
  try {
    await RedisService.syncPlayerAllData('1');
    console.log('同步单个玩家数据成功');
  } catch (error) {
    console.error('同步单个玩家数据失败:', error);
  }
  
  console.log('\n数据同步测试完成');
}

testSync();
