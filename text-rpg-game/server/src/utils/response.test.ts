import { success, fail } from './response';

describe('response', () => {
  const mockRes = () => {
    const res: any = {};
    res.json = jest.fn();
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('success', () => {
    it('返回 code=0, msg=success, data', () => {
      const res = mockRes();
      success(res, { id: 1 }, 'ok');
      expect(res.json).toHaveBeenCalledWith({
        code: 0,
        msg: 'ok',
        data: { id: 1 },
      });
    });

    it('默认 msg 为 success', () => {
      const res = mockRes();
      success(res, null);
      expect(res.json).toHaveBeenCalledWith({
        code: 0,
        msg: 'success',
        data: null,
      });
    });
  });

  describe('fail', () => {
    it('返回 code, msg, data 并设置 HTTP 状态码', () => {
      const res = mockRes();
      fail(res, 40000, '参数错误');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        code: 40000,
        msg: '参数错误',
        data: null,
      });
    });

    it('UNAUTHORIZED 返回 401', () => {
      const res = mockRes();
      fail(res, 40002, '未授权');
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('NOT_FOUND 返回 404', () => {
      const res = mockRes();
      fail(res, 40001, '未找到', { id: 99 });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        code: 40001,
        msg: '未找到',
        data: { id: 99 },
      });
    });
  });
});
