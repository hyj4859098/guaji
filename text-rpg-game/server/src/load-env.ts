/**
 * 优先加载 .env，生产环境可用系统环境变量，dotenv 缺失时不影响启动
 */
try {
  require('dotenv/config');
} catch {
  /* dotenv 未安装时跳过，使用 process.env 或 config 默认值 */
}
