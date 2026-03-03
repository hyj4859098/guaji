const { MongoClient } = require('mongodb');

const BOOST_ITEMS = [
  { id: 101, name: '双倍经验卡', type: 5, boost_category: 'exp', boost_multiplier: 2, boost_charges: 100, description: '使用后增加100次双倍经验' },
  { id: 102, name: '四倍经验卡', type: 5, boost_category: 'exp', boost_multiplier: 4, boost_charges: 100, description: '使用后增加100次四倍经验' },
  { id: 103, name: '八倍经验卡', type: 5, boost_category: 'exp', boost_multiplier: 8, boost_charges: 100, description: '使用后增加100次八倍经验' },
  { id: 104, name: '双倍金币卡', type: 5, boost_category: 'gold', boost_multiplier: 2, boost_charges: 100, description: '使用后增加100次双倍金币' },
  { id: 105, name: '四倍金币卡', type: 5, boost_category: 'gold', boost_multiplier: 4, boost_charges: 100, description: '使用后增加100次四倍金币' },
  { id: 106, name: '八倍金币卡', type: 5, boost_category: 'gold', boost_multiplier: 8, boost_charges: 100, description: '使用后增加100次八倍金币' },
  { id: 107, name: '双倍掉落卡', type: 5, boost_category: 'drop', boost_multiplier: 2, boost_charges: 100, description: '使用后增加100次双倍掉落' },
  { id: 108, name: '四倍掉落卡', type: 5, boost_category: 'drop', boost_multiplier: 4, boost_charges: 100, description: '使用后增加100次四倍掉落' },
  { id: 109, name: '八倍掉落卡', type: 5, boost_category: 'drop', boost_multiplier: 8, boost_charges: 100, description: '使用后增加100次八倍掉落' },
  { id: 110, name: '双倍声望卡', type: 5, boost_category: 'reputation', boost_multiplier: 2, boost_charges: 100, description: '使用后增加100次双倍声望' },
  { id: 111, name: '四倍声望卡', type: 5, boost_category: 'reputation', boost_multiplier: 4, boost_charges: 100, description: '使用后增加100次四倍声望' },
  { id: 112, name: '八倍声望卡', type: 5, boost_category: 'reputation', boost_multiplier: 8, boost_charges: 100, description: '使用后增加100次八倍声望' },
];

async function init() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('turn-based-game');
    const col = db.collection('item');

    for (const item of BOOST_ITEMS) {
      const exists = await col.findOne({ id: item.id });
      if (exists) {
        await col.updateOne({ id: item.id }, { $set: item });
        console.log(`Updated: ${item.name} (id=${item.id})`);
      } else {
        await col.insertOne(item);
        console.log(`Inserted: ${item.name} (id=${item.id})`);
      }
    }
    console.log('Done: 12 boost items initialized.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.close();
  }
}

init();
