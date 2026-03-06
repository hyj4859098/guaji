/**
 * ConfigService 集成测试 - get、set、不存在的配置
 */
import { ConfigService } from '../../service/config.service';

describe('ConfigService 集成测试', () => {
  const configService = new ConfigService();

  it('get 不存在的配置返回 undefined', () => {
    const value = configService.get(`_nonexistent_${Date.now()}`);
    expect(value).toBeUndefined();
  });

  it('set 创建配置后 get 可读取', () => {
    const name = `_test_cfg_${Date.now()}`;
    const value = { foo: 1, bar: 'baz' };
    configService.set(name, value);
    const got = configService.get(name);
    expect(got).toEqual(value);
  });

  it('set 更新已有配置', () => {
    const name = `_test_cfg_upd_${Date.now()}`;
    configService.set(name, { v: 1 });
    configService.set(name, { v: 2 });
    const got = configService.get(name);
    expect(got).toEqual({ v: 2 });
  });

  it('get 带默认值返回默认值', () => {
    const name = `_test_cfg_def_${Date.now()}`;
    const defaultValue = { default: true };
    const got = configService.get(name, defaultValue);
    expect(got).toEqual(defaultValue);
  });
});
