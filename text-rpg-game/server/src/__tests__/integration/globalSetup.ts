/**
 * 真实集成测试 - 全局启动
 * 启动 MongoDB Memory Server，将 URI 写入文件供 setup 使用
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as path from 'path';
import * as fs from 'fs';

const URI_FILE = path.join(__dirname, '.mongo-uri.json');

export default async function globalSetup(): Promise<void> {
  const instance = await MongoMemoryServer.create();
  const uri = instance.getUri();
  const database = 'turn-based-game-test';

  (global as any).__MONGO_INSTANCE = instance;

  fs.writeFileSync(URI_FILE, JSON.stringify({ uri, database }), 'utf-8');
  console.log('[integration] MongoDB Memory Server started');
}
