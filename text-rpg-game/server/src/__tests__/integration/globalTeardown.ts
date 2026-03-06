/**
 * 真实集成测试 - 全局清理
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as path from 'path';
import * as fs from 'fs';

const URI_FILE = path.join(__dirname, '.mongo-uri.json');

export default async function globalTeardown(): Promise<void> {
  const instance = (global as any).__MONGO_INSTANCE as MongoMemoryServer | undefined;
  if (instance) {
    await instance.stop();
    console.log('[integration] MongoDB Memory Server stopped');
  }
  try {
    fs.unlinkSync(URI_FILE);
  } catch {
    // ignore
  }
}
