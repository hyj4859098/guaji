/**
 * 认证中间件单元测试 - auth、adminAuth 各分支
 */
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { auth, adminAuth } from './auth';
import { config } from '../config';

const mockNext = jest.fn();
const mockFail = jest.fn();

jest.mock('../utils/response', () => ({
  fail: (res: any, code: number, msg: string) => {
    mockFail(res, code, msg);
    return res;
  },
}));

const mockGetByCondition = jest.fn();
jest.mock('../service/data-storage.service', () => ({
  dataStorageService: {
    getByCondition: (...args: any[]) => mockGetByCondition(...args),
  },
}));

function mockRes(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('auth 中间件', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('无 Authorization 返回 401', () => {
    const req = { headers: {} } as Request;
    const res = mockRes() as Response;
    auth(req as any, res, mockNext);
    expect(mockFail).toHaveBeenCalledWith(res, expect.any(Number), '缺少认证令牌');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('无效 token 返回 401', () => {
    const req = { headers: { authorization: 'Bearer invalid_token' } } as Request;
    const res = mockRes() as Response;
    auth(req as any, res, mockNext);
    expect(mockFail).toHaveBeenCalledWith(res, expect.any(Number), '无效的认证令牌');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('有效 token 调用 next', () => {
    const token = jwt.sign({ uid: 123 }, config.jwt_secret, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes() as Response;
    auth(req as any, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect((req as any).uid).toBe(123);
  });
});

describe('adminAuth 中间件', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('无 Authorization 返回 401', async () => {
    const req = { headers: {} } as Request;
    const res = mockRes() as Response;
    await adminAuth(req as any, res, mockNext);
    expect(mockFail).toHaveBeenCalledWith(res, expect.any(Number), '缺少认证令牌');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('无效 token 返回 401', async () => {
    const req = { headers: { authorization: 'Bearer invalid_token' } } as Request;
    const res = mockRes() as Response;
    await adminAuth(req as any, res, mockNext);
    expect(mockFail).toHaveBeenCalledWith(res, expect.any(Number), '无效的认证令牌');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('有效 token 但非管理员返回 401', async () => {
    mockGetByCondition.mockResolvedValue({ id: 1, is_admin: false });
    const token = jwt.sign({ uid: 1 }, config.jwt_secret, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes() as Response;
    await adminAuth(req as any, res, mockNext);
    expect(mockFail).toHaveBeenCalledWith(res, expect.any(Number), '权限不足');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('有效 token 用户不存在返回 401', async () => {
    mockGetByCondition.mockResolvedValue(null);
    const token = jwt.sign({ uid: 999 }, config.jwt_secret, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes() as Response;
    await adminAuth(req as any, res, mockNext);
    expect(mockFail).toHaveBeenCalledWith(res, expect.any(Number), '权限不足');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('有效 token 且为管理员调用 next', async () => {
    mockGetByCondition.mockResolvedValue({ id: 1, is_admin: true });
    const token = jwt.sign({ uid: 1 }, config.jwt_secret, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes() as Response;
    await adminAuth(req as any, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect((req as any).user?.isAdmin).toBe(true);
  });
});
