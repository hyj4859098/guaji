const isProduction = process.env.NODE_ENV === 'production';

/** 从环境变量读取配置，无则使用默认值（开发用） */
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwt_secret: process.env.JWT_SECRET || (isProduction ? '' : 'dev-only-unsafe-secret'),
  jwt_expire: process.env.JWT_EXPIRE || '7d',
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'turn-based-game'
  },
  ws_port: parseInt(process.env.WS_PORT || '3001', 10),
  ws_url: process.env.WS_URL || '',
  cors_origins: process.env.CORS_ORIGINS || '',
  ws: {
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000', 10),
    maxMessageQueueSize: parseInt(process.env.WS_MAX_QUEUE || '50', 10),
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
    heartbeatTimeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT || '60000', 10),
    msgRateWindowMs: parseInt(process.env.WS_RATE_WINDOW || '5000', 10),
    msgRateMax: parseInt(process.env.WS_RATE_MAX || '20', 10),
  },
};

/** 生产环境启动前校验必需配置，缺失则拒绝启动 */
export function validateConfig(): void {
  const errors: string[] = [];
  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET 未设置（生产环境必需）');
    }
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI 未设置（生产环境必需）');
    }
  }
  if (config.jwt_secret === 'your-secret-key-change-in-production') {
    errors.push('JWT_SECRET 仍为示例值，请更换为强随机字符串');
  }
  if (errors.length > 0) {
    const msg = errors.map(e => `  - ${e}`).join('\n');
    // logger 可能尚未初始化，同时输出到 stderr
    const text = `\n[FATAL] 配置校验失败:\n${msg}\n`;
    try { require('../utils/logger').logger.error(text); } catch { /* noop */ }
    process.stderr.write(text);
    process.exit(1);
  }
}
