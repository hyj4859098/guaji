const mysql = require('mysql2/promise');
const redis = require('redis');
const config = require('./dist/config/index.js').config;

async function connectMySQL() {
  try {
    const pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('MySQL连接成功');
    return pool;
  } catch (error) {
    console.error('MySQL连接失败:', error);
    return null;
  }
}

async function connectRedis() {
  try {
    const client = redis.createClient({
      url: config.redis?.url || 'redis://localhost:6379'
    });
    await client.connect();
    console.log('Redis连接成功');
    return client;
  } catch (error) {
    console.error('Redis连接失败:', error);
    return null;
  }
}

async function getMySQLTables(pool) {
  try {
    const [rows] = await pool.execute('SHOW TABLES');
    return rows.map(row => Object.values(row)[0]);
  } catch (error) {
    console.error('获取MySQL表列表失败:', error);
    return [];
  }
}

async function getMySQLTableStructure(pool, table) {
  try {
    const [rows] = await pool.execute(`DESCRIBE ${table}`);
    return rows;
  } catch (error) {
    console.error(`获取MySQL表${table}结构失败:`, error);
    return [];
  }
}

async function getMySQLTableData(pool, table, limit = 5) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM ${table} LIMIT ${limit}`);
    return rows;
  } catch (error) {
    console.error(`获取MySQL表${table}数据失败:`, error);
    return [];
  }
}

async function getRedisKeys(client) {
  try {
    const keys = await client.keys('*');
    return keys;
  } catch (error) {
    console.error('获取Redis键失败:', error);
    return [];
  }
}

async function getRedisValue(client, key) {
  try {
    const value = await client.get(key);
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error(`获取Redis键${key}值失败:`, error);
    return null;
  }
}

async function main() {
  console.log('开始比较MySQL和Redis数据库结构...');
  
  // 连接数据库
  const mysqlPool = await connectMySQL();
  const redisClient = await connectRedis();
  
  if (!mysqlPool || !redisClient) {
    console.error('数据库连接失败，无法继续');
    return;
  }
  
  // 获取MySQL表结构
  console.log('\n=== MySQL数据库结构 ===');
  const tables = await getMySQLTables(mysqlPool);
  console.log('表列表:', tables);
  
  for (const table of tables) {
    console.log(`\n--- 表: ${table} ---`);
    const structure = await getMySQLTableStructure(mysqlPool, table);
    console.log('结构:', structure);
    const data = await getMySQLTableData(mysqlPool, table);
    console.log('数据:', data);
  }
  
  // 获取Redis数据结构
  console.log('\n=== Redis数据库结构 ===');
  const keys = await getRedisKeys(redisClient);
  console.log('键列表:', keys);
  
  for (const key of keys) {
    console.log(`\n--- 键: ${key} ---`);
    const value = await getRedisValue(redisClient, key);
    console.log('值:', value);
  }
  
  // 关闭连接
  await mysqlPool.end();
  await redisClient.quit();
  console.log('\n比较完成，连接已关闭');
}

main();
