import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { config } from '../config';
import { fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { dataStorageService } from '../service/data-storage.service';
import { logger } from '../utils/logger';

// 扩展Request类型（uid 支持数字与字符串，老用户可能用 _id 字符串）
export interface AuthRequest extends Request {
  user?: {
    uid: number | string;
    isAdmin?: boolean;
  };
  uid?: number | string;
}

/**
 * 认证中间件
 */
export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return fail(res, ErrorCode.UNAUTHORIZED, '缺少认证令牌');
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, config.jwt_secret, { algorithms: ['HS256'] }) as { uid: number | string };
    req.user = { uid: decoded.uid };
    req.uid = decoded.uid;
    next();
  } catch (error) {
    logger.error('Token verification error:', error);
    return fail(res, ErrorCode.UNAUTHORIZED, '无效的认证令牌');
  }
}

/**
 * 管理员认证中间件
 * 支持 token 中 uid 为数字 id 或 _id 字符串（24 位十六进制）
 */
export async function adminAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return fail(res, ErrorCode.UNAUTHORIZED, '缺少认证令牌');
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, config.jwt_secret, { algorithms: ['HS256'] }) as { uid: number | string };

    let user = null;
    if (typeof decoded.uid === 'string' && /^[a-f0-9]{24}$/i.test(decoded.uid)) {
      user = await dataStorageService.getByCondition('user', { _id: new ObjectId(decoded.uid) });
    } else if (typeof decoded.uid === 'number') {
      user = await dataStorageService.getByCondition('user', { id: decoded.uid });
    }

    if (!user || !user.is_admin) {
      return fail(res, ErrorCode.UNAUTHORIZED, '权限不足');
    }

    req.user = { uid: decoded.uid, isAdmin: true };
    req.uid = decoded.uid;
    next();
  } catch (error) {
    logger.error('Admin token verification error:', error);
    return fail(res, ErrorCode.UNAUTHORIZED, '无效的认证令牌');
  }
}