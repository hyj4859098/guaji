const { MongoClient } = require('mongodb');

async function setAdmin() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    // 连接到MongoDB
    await client.connect();
    console.log('MongoDB connected successfully');
    
    // 选择数据库
    const db = client.db('turn-based-game');
    
    // 获取用户集合
    const userCollection = db.collection('user');
    
    // 查找用户asd4859098
    const user = await userCollection.findOne({ username: 'asd4859098' });
    
    if (!user) {
      console.log('用户asd4859098不存在');
      return;
    }
    
    // 更新用户为管理员
    await userCollection.updateOne(
      { username: 'asd4859098' },
      {
        $set: {
          is_admin: true
        }
      }
    );
    
    console.log('成功将用户asd4859098设置为管理员');
    
  } catch (error) {
    console.error('设置管理员失败:', error);
  } finally {
    // 关闭连接
    await client.close();
  }
}

setAdmin();
