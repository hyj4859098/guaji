/**
 * 创建测试用管理员（用于 API 测试）
 * 用法：node scripts/create-test-admin.js（从项目根目录）或 node ../scripts/create-test-admin.js（从 server 目录）
 * 将创建/更新用户 admin / admin123 为管理员（密码已 bcrypt 哈希）
 * 默认使用 MONGODB_DATABASE 环境变量指定的库（test-all 会设为 turn-based-game-test）
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require(path.join(__dirname, '../server/node_modules/bcrypt'));

const ADMIN_PASS = 'admin123';

async function main() {
  const hashed = await bcrypt.hash(ADMIN_PASS, 10);
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE || 'turn-based-game-test');
  const coll = db.collection('user');
  const existing = await coll.findOne({ username: 'admin' });
  if (existing) {
    await coll.updateOne({ username: 'admin' }, { $set: { is_admin: true, password: hashed } });
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
      password: hashed,
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
