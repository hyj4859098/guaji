#!/usr/bin/env node
/**
 * 数据库层（db.ts）专项验证
 * 使用独立测试库 turn-based-game-test，不污染正式库
 * 用法：确保 MongoDB 已启动，然后执行 node scripts/test-db-layer.js
 */
process.env.MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'turn-based-game-test';

const path = require('path');

// 加载编译后的 db 模块（需先 build）
const serverDir = path.join(__dirname, '..', 'server');
const dbPath = path.join(serverDir, 'dist', 'config', 'db.js');

let connect, query, insert, update, deleteOne, findOneAndUpdate, getNextId, getCollection;
try {
  const db = require(dbPath);
  connect = db.connect;
  query = db.query;
  insert = db.insert;
  update = db.update;
  deleteOne = db.deleteOne;
  findOneAndUpdate = db.findOneAndUpdate;
  getNextId = db.getNextId;
  getCollection = db.getCollection;
} catch (e) {
  console.error('无法加载 db 模块，请先执行: cd server && npm run build');
  console.error(e.message);
  process.exit(1);
}

const TEST_COLLECTION = '_db_layer_test_' + Date.now();

async function main() {
  const results = [];
  function ok(name, detail = '') {
    results.push({ name, pass: true, detail });
    console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`);
  }
  function fail(name, err) {
    results.push({ name, pass: false, detail: String(err) });
    console.log(`  ✗ ${name}: ${err}`);
  }

  console.log('\n=== 数据库层 (db.ts) 验证 ===\n');

  try {
    await connect();
    ok('connect', 'MongoDB 连接成功');
  } catch (e) {
    fail('connect', e.message);
    console.log('  提示：请确保 MongoDB 已启动');
    process.exit(1);
  }

  try {
    // 1. query
    const empty = await query(TEST_COLLECTION);
    if (Array.isArray(empty) && empty.length === 0) ok('query 空集合');
    else fail('query 空集合', '应返回空数组');

    // 2. insert 自动 id
    const r1 = await insert(TEST_COLLECTION, { name: 'a', value: 1 });
    if (r1 && typeof r1.insertId === 'number') ok('insert 自动 id', `insertId=${r1.insertId}`);
    else fail('insert 自动 id', '应返回 insertId');

    // 3. insert 指定 customId
    const customId = 99999;
    const r2 = await insert(TEST_COLLECTION, { id: customId, name: 'b', value: 2 });
    if (r2 && r2.insertId === customId) ok('insert customId', `id=${customId}`);
    else fail('insert customId', `期望 ${customId}，实际 ${r2?.insertId}`);

    // 4. query 有数据
    const list = await query(TEST_COLLECTION, {});
    if (Array.isArray(list) && list.length >= 2) ok('query 有数据', `len=${list.length}`);
    else fail('query 有数据', `期望至少 2 条，实际 ${list?.length}`);

    // 5. update
    const upd = await update(TEST_COLLECTION, { id: r1.insertId }, { value: 100 });
    if (upd && upd.affectedRows === 1) ok('update');
    else fail('update', `affectedRows=${upd?.affectedRows}`);

    // 6. findOneAndUpdate
    const doc = await findOneAndUpdate(
      TEST_COLLECTION,
      { id: r1.insertId },
      { $set: { value: 200 } },
      { returnDocument: 'after' }
    );
    if (doc && doc.value === 200) ok('findOneAndUpdate');
    else fail('findOneAndUpdate', doc ? `value=${doc.value}` : '无返回');

    // 7. getNextId（若存在）
    if (typeof getNextId === 'function') {
      const nextId = await getNextId(TEST_COLLECTION + '_seq');
      if (typeof nextId === 'number' && nextId >= 1) ok('getNextId', `id=${nextId}`);
      else fail('getNextId', `期望 number>=1，实际 ${nextId}`);
    }

    // 8. deleteOne
    const del = await deleteOne(TEST_COLLECTION, { id: r1.insertId });
    if (del && del.affectedRows === 1) ok('deleteOne');
    else fail('deleteOne', `affectedRows=${del?.affectedRows}`);

    // 清理测试集合
    const coll = getCollection(TEST_COLLECTION);
    await coll.deleteMany({});
    ok('清理测试数据');
  } catch (e) {
    fail('执行异常', e.message);
    console.error(e);
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`\n=== 结果: ${passed}/${total} 通过 ===\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
