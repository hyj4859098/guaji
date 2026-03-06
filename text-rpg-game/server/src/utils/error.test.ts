import { ErrorCode, AppError, createError } from './error';

describe('error', () => {
  describe('AppError', () => {
    it('应正确创建 AppError', () => {
      const err = new AppError({ code: ErrorCode.INVALID_PARAMS, message: '参数错误' });
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.INVALID_PARAMS);
      expect(err.message).toBe('参数错误');
      expect(err.name).toBe('AppError');
    });

    it('应支持 cause', () => {
      const cause = new Error('原始错误');
      const err = new AppError({ code: ErrorCode.SYSTEM_ERROR, message: '系统错误', cause });
      expect(err.cause).toBe(cause);
    });
  });

  describe('createError', () => {
    it('应返回 AppError 实例', () => {
      const err = createError(ErrorCode.NOT_FOUND, '未找到');
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toBe('未找到');
    });
  });
});
