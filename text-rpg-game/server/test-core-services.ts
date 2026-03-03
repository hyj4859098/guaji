import { dataStorageService } from './src/service/data-storage.service';
import { configService } from './src/service/config.service';

async function testDataStorageService() {
  console.log('=== 测试 DataStorageService ===');
  
  try {
    // 测试插入数据
    console.log('1. 测试插入数据');
    const insertId = await dataStorageService.insert('player', {
      uid: 1,
      name: '测试玩家',
      level: 1,
      exp: 0,
      hp: 100,
      max_hp: 100,
      gold: 1000
    });
    console.log(`插入成功，ID: ${insertId}`);
    
    // 测试获取数据
    console.log('2. 测试获取数据');
    const player = await dataStorageService.getById('player', insertId);
    console.log('获取到的玩家数据:', player);
    
    // 测试更新数据
    console.log('3. 测试更新数据');
    const updateResult = await dataStorageService.update('player', insertId, {
      gold: 2000,
      level: 2
    });
    console.log(`更新结果: ${updateResult}`);
    
    // 测试再次获取数据
    console.log('4. 测试再次获取数据');
    const updatedPlayer = await dataStorageService.getById('player', insertId);
    console.log('更新后的玩家数据:', updatedPlayer);
    
    // 测试列表查询
    console.log('5. 测试列表查询');
    const players = await dataStorageService.list('player', { uid: 1 });
    console.log('玩家列表:', players);
    
    // 测试删除数据
    console.log('6. 测试删除数据');
    const deleteResult = await dataStorageService.delete('player', insertId);
    console.log(`删除结果: ${deleteResult}`);
    
    // 测试批量插入
    console.log('7. 测试批量插入');
    const batchData = [
      { uid: 1, name: '批量测试1', level: 1, exp: 0, hp: 100, max_hp: 100, gold: 1000 },
      { uid: 1, name: '批量测试2', level: 1, exp: 0, hp: 100, max_hp: 100, gold: 1000 }
    ];
    const batchIds = await dataStorageService.batchInsert('player', batchData);
    console.log(`批量插入成功，IDs: ${batchIds}`);
    
    // 清理测试数据
    for (const id of batchIds) {
      await dataStorageService.delete('player', id);
    }
    console.log('测试数据清理完成');
    
  } catch (error) {
    console.error('测试 DataStorageService 失败:', error);
  }
}

async function testConfigService() {
  console.log('\n=== 测试 ConfigService ===');
  
  try {
    // 测试设置配置
    console.log('1. 测试设置配置');
    configService.set('test_config', { value: 'test_value', timestamp: Date.now() });
    console.log('配置设置成功');
    
    // 测试获取配置
    console.log('2. 测试获取配置');
    const configValue = configService.get('test_config');
    console.log('获取到的配置:', configValue);
    
    // 测试默认值
    console.log('3. 测试默认值');
    const defaultConfig = configService.get('non_existent_config', 'default_value');
    console.log('获取到的默认配置:', defaultConfig);
    
    // 测试保存到文件
    console.log('4. 测试保存到文件');
    configService.saveToFile('test_config');
    console.log('配置保存到文件成功');
    
    console.log('ConfigService 测试完成');
    
  } catch (error) {
    console.error('测试 ConfigService 失败:', error);
  }
}

async function runTests() {
  await testDataStorageService();
  await testConfigService();
  console.log('\n=== 所有测试完成 ===');
  process.exit(0);
}

runTests();
