import * as fs from 'fs';
import * as path from 'path';
import { Logger, LogLevel, logger } from './logger';

describe('logger', () => {
  let consoleSpy: { log: jest.SpyInstance; info: jest.SpyInstance; warn: jest.SpyInstance; error: jest.SpyInstance };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Logger 单例', () => {
    it('getInstance 返回同一实例', () => {
      const a = Logger.getInstance();
      const b = Logger.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('log 方法', () => {
    it('debug 调用 console.log', () => {
      logger.debug('test msg');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test msg'));
    });

    it('info 调用 console.info', () => {
      logger.info('info msg');
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('info msg'));
    });

    it('warn 调用 console.warn', () => {
      logger.warn('warn msg');
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('warn msg'));
    });

    it('error 调用 console.error', () => {
      logger.error('error msg');
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('error msg'));
    });

    it('log 带 meta 时序列化', () => {
      logger.info('msg', { uid: 1 });
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('{"uid":1}'));
    });
  });

  describe('配置方法', () => {
    it('setMaxFileSize 可调用', () => {
      const inst = Logger.getInstance() as any;
      expect(() => inst.setMaxFileSize(1024)).not.toThrow();
    });

    it('setMaxFiles 可调用', () => {
      const inst = Logger.getInstance() as any;
      expect(() => inst.setMaxFiles(3)).not.toThrow();
    });

    it('setLogDir 设置目录后可写入', () => {
      const os = require('os');
      const tmpDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
      const inst = Logger.getInstance() as any;
      inst.setLogDir(tmpDir);
      inst.info('写入文件测试', { test: 1 });
      try {
        const files = fs.readdirSync(tmpDir);
        expect(files.some((f: string) => f.startsWith('app-'))).toBe(true);
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    it('setLogDir 不存在的目录会创建', () => {
      const os = require('os');
      const tmpDir = path.join(os.tmpdir(), `logger-mkdir-${Date.now()}`, 'nested');
      const inst = Logger.getInstance() as any;
      inst.setLogDir(tmpDir);
      expect(fs.existsSync(tmpDir)).toBe(true);
      try { fs.rmSync(path.dirname(tmpDir), { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('rotateLogFile 文件超大小后轮转', () => {
      const os = require('os');
      const tmpDir = path.join(os.tmpdir(), `logger-rotate-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const inst = Logger.getInstance() as any;
      inst.setLogDir(tmpDir);
      inst.setMaxFileSize(20);
      inst.setMaxFiles(3);
      inst.info('a'.repeat(30));
      inst.info('b');
      try {
        const files = fs.readdirSync(tmpDir);
        const hasBackup = files.some((f: string) => /app-.*\.1\.log$/.test(f));
        expect(hasBackup).toBe(true);
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    it('写入文件失败时捕获错误', () => {
      const os = require('os');
      const tmpDir = path.join(os.tmpdir(), `logger-err-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const inst = Logger.getInstance() as any;
      inst.setLogDir(tmpDir);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      inst.info('should not throw');
      const writeErrCalls = (consoleSpy.error as jest.Mock).mock.calls.filter(
        (c: unknown[]) => c[0] === 'Error writing to log file:'
      );
      expect(writeErrCalls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
