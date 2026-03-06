#!/usr/bin/env node
/**
 * 清理正式库 turn-based-game 中的测试数据
 * 删除：e2e_、_ 开头、rate_limit_test_ 开头的用户及其关联数据
 * 保留：admin 及正常用户，不碰配置/物品/怪物等
 *
 * 用法：node scripts/clean-production-db.js [--confirm]
 * 必须加 --confirm 才会执行，否则仅打印预览
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'turn-based-game';

const TEST_USER_REGEX = /^(e2e_|_|rate_limit_test_)/;

async function main() {
  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log('用法：node scripts/clean-production-db.js --confirm');
    console.log('未加 --confirm，仅预览，不执行删除。\n');
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const userColl = db.collection('user');
    const testUsers = await userColl.find({ username: TEST_USER_REGEX }).toArray();
    if (testUsers.length === 0) {
      console.log(`[${DB_NAME}] 未发现测试用户（e2e_、_ 开头、rate_limit_test_），无需清理。`);
      return;
    }

    const rawUids = testUsers.map((u) => (u.id != null && u.id !== '' ? u.id : String(u._id)));
    const uids = [...new Set(rawUids.flatMap((uid) => {
      const n = Number(uid);
      return Number.isInteger(n) ? [n, String(uid)] : [uid];
    }))];
    const usernames = testUsers.map((u) => u.username).join(', ');

    console.log(`[${DB_NAME}] 发现 ${testUsers.length} 个测试用户: ${usernames}`);
    console.log(`UID 列表: ${uids.join(', ')}\n`);

    const collections = [
      { name: 'auction', field: 'seller_uid' },
      { name: 'auction_record', field: 'uid' },
      { name: 'bag', field: 'uid' },
      { name: 'equip_instance', field: 'uid' },
      { name: 'user_equip', field: 'uid' },
      { name: 'player_skill', field: 'uid' },
      { name: 'player', field: 'uid' },
    ];

    let totalDeleted = 0;
    for (const { name, field } of collections) {
      const coll = db.collection(name);
      const filter = { [field]: { $in: uids } };
      const count = await coll.countDocuments(filter);
      if (count > 0) {
        console.log(`  ${name}: ${count} 条`);
        if (confirm) {
          const r = await coll.deleteMany(filter);
          totalDeleted += r.deletedCount;
        }
      }
    }

    if (confirm) {
      const r = await userColl.deleteMany({ username: TEST_USER_REGEX });
      totalDeleted += r.deletedCount;
      console.log(`  user: ${r.deletedCount} 条`);
      console.log(`\n[完成] 共删除 ${totalDeleted} 条测试数据。`);
    } else {
      console.log('\n[预览] 以上集合将删除对应条数。加 --confirm 执行。');
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
