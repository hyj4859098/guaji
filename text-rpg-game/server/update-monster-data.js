const { MongoClient } = require('mongodb');

async function updateMonsterData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    // 连接到MongoDB
    await client.connect();
    console.log('MongoDB connected successfully');
    
    // 选择数据库
    const db = client.db('turn-based-game');
    
    // 获取怪物集合
    const monsterCollection = db.collection('monster');
    
    // 更新现有的怪物数据，添加缺失的字段
    await monsterCollection.updateMany(
      {},
      {
        $set: {
          mp: 0,
          hit_rate: 80,
          dodge_rate: 10,
          crit_rate: 5,
          reputation: 1,
          create_time: Math.floor(Date.now() / 1000),
          update_time: Math.floor(Date.now() / 1000)
        }
      }
    );
    
    // 针对特定怪物进行个性化更新
    await monsterCollection.updateOne(
      { id: 1, name: '哥布林' },
      {
        $set: {
          hit_rate: 80,
          dodge_rate: 10,
          crit_rate: 5,
          reputation: 1
        }
      }
    );
    
    await monsterCollection.updateOne(
      { id: 2, name: '骷髅兵' },
      {
        $set: {
          hit_rate: 85,
          dodge_rate: 15,
          crit_rate: 8,
          reputation: 2
        }
      }
    );
    
    console.log('Updated monster data successfully!');
    
  } catch (error) {
    console.error('Error updating monster data:', error);
  } finally {
    // 关闭连接
    await client.close();
  }
}

updateMonsterData();
