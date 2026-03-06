import { authLimiter } from './rate-limit';

describe('rate-limit', () => {
  it('authLimiter 导出为 Express 中间件函数', () => {
    expect(authLimiter).toBeDefined();
    expect(typeof authLimiter).toBe('function');
  });

  it('authLimiter 配置正确导入', () => {
    // 验证模块能正确加载，rate-limit 在 app 中挂载后生效
    expect(authLimiter.length).toBe(3); // (req, res, next)
  });
});
