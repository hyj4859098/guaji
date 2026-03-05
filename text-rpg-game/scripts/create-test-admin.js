/**
 * 创建测试用管理员（用于 API 测试）
 * 用法：node scripts/create-test-admin.js
 * 将创建/更新用户 admin / admin123 为管理员
 */
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('turn-based-game');
  const coll = db.collection('user');
  const existing = await coll.findOne({ username: 'admin' });
  if (existing) {
    await coll.updateOne({ username: 'admin' }, { $set: { is_admin: true, password: 'admin123' } });
    console.log('Updated admin user (password: admin123)');
  } else {
    const counter = await db.collection('counter').findOneAndUpdate(
      { name: 'user' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const id = (counter?.value?.seq ?? counter?.seq) || 999;
    await coll.insertOne({
      id,
      username: 'admin',
      password: 'admin123',
      is_admin: true,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    });
    console.log('Created admin user (admin / admin123)');
  }
  await client.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
