const { MongoClient } = require('mongodb');
async function check() {
  const c = new MongoClient('mongodb://localhost:27017');
  await c.connect();
  const db = c.db('turn-based-game');
  const admin = await db.collection('user').findOne({ is_admin: true });
  console.log(admin ? 'Admin exists: ' + admin.username : 'No admin user found');
  await c.close();
}
check().catch(e => console.log('Error:', e.message));
