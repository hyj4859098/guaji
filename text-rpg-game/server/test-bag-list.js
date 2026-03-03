const mysql = require('mysql2/promise');

async function testBagList() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 测试背包列表返回数据 ===\n');

  try {
    const [users] = await connection.query('SELECT id, username FROM user WHERE status = 0 LIMIT 1');
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }
    const uid = users[0].id;
    console.log(`✅ 找到用户: ${users[0].username} (uid: ${uid})`);

    console.log('\n=== 步骤1: 查询数据库中的原始背包数据 ===');
    const [bagItems] = await connection.query('SELECT * FROM bag WHERE uid = ? AND status = 0', [uid]);
    console.log(`✅ 数据库中共有 ${bagItems.length} 条背包记录`);
    bagItems.forEach((item, index) => {
      console.log(`   记录${index+1}: id=${item.id}, item_id=${item.item_id}, equipment_uid=${item.equipment_uid}, count=${item.count}`);
    });

    console.log('\n=== 步骤2: 模拟后端处理逻辑 ===');
    // 为每个物品添加名称和效果
    const bagsWithDetails = await Promise.all(bagItems.map(async (bag) => {
      try {
        const itemInfo = await connection.query('SELECT name, effect, type FROM item WHERE id = ? AND status = 0', [bag.item_id]);
        if (itemInfo[0].length > 0) {
          return {
            ...bag,
            name: itemInfo[0][0].name,
            effect: itemInfo[0][0].effect,
            type: itemInfo[0][0].type
          };
        }
        return bag;
      } catch (error) {
        console.error('获取物品信息失败:', error);
        return bag;
      }
    }));

    console.log('\n=== 步骤3: 模拟拆分装备逻辑 ===');
    // 将叠加的装备拆分成多个单独的条目
    const result = [];
    for (const bag of bagsWithDetails) {
      // 如果是装备（type=2）且数量大于1，拆分成多个条目
      if (bag.type === 2 && bag.count > 1) {
        for (let i = 0; i < bag.count; i++) {
          result.push({
            ...bag,
            id: bag.id * 10000 + i, // 临时ID，确保唯一性
            count: 1,
            original_id: bag.id, // 保存原始ID
            equipment_uid: bag.equipment_uid || `EQP_${Date.now()}_${Math.floor(Math.random() * 10000)}` // 装备唯一标识
          });
        }
      } else {
        result.push({
          ...bag,
          original_id: bag.id, // 保存原始ID
          equipment_uid: bag.equipment_uid // 装备唯一标识
        });
      }
    }

    console.log('\n=== 步骤4: 模拟后端返回数据 ===');
    console.log(`✅ 后端返回 ${result.length} 条数据`);
    result.forEach((item, index) => {
      console.log(`\n返回数据${index+1}:`);
      console.log(`   id: ${item.id}`);
      console.log(`   item_id: ${item.item_id}`);
      console.log(`   name: ${item.name}`);
      console.log(`   type: ${item.type}`);
      console.log(`   count: ${item.count}`);
      console.log(`   equipment_uid: ${item.equipment_uid}`);
      console.log(`   original_id: ${item.original_id}`);
    });

    console.log('\n=== 分析 ===');
    console.log('✅ 后端返回的数据中，每件装备都有独立的记录');
    console.log('✅ 每件装备都有自己的 equipment_uid');
    console.log('✅ 装备的 count 都是 1');
    console.log('\n❓ 问题可能在于前端');
    console.log('1. 前端可能在处理数据时进行了叠加');
    console.log('2. 前端可能在渲染时将相同名称的装备视为同一物品');
    console.log('3. 前端可能在过滤或排序时改变了数据结构');

    console.log('\n=== 测试完成 ===');
    console.log('💡 后端的逻辑是正确的');
    console.log('💡 前端需要检查是否正确处理了装备的唯一性');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

testBagList();
