/**
 * Admin API 公共工具，消除 CRUD 重复代码
 */
import { Request, Response, NextFunction } from 'express';
import { success, fail } from '../../utils/response';
import { ErrorCode, AppError } from '../../utils/error';
import { logger } from '../../utils/logger';

/** 解析路由参数，无效时 fail 并返回 null；paramName 默认 'id'，支持 'itemId' 等 */
export function parseIdParam(req: Request, res: Response, entityName = 'ID', paramName = 'id'): number | null {
  const raw = req.params[paramName];
  const id = parseInt(String(raw), 10);
  if (isNaN(id) || id < 1) {
    fail(res, ErrorCode.INVALID_PARAMS, `无效的${entityName}`);
    return null;
  }
  return id;
}

/** 包装 Admin 处理器：统一 try/catch、AppError 转 fail、错误日志 */
export function adminHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  logMsg: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error instanceof AppError) {
        fail(res, error.code, error.message);
        return;
      }
      logger.error(logMsg, error);
      next(error);
    }
  };
}

/** GET / - 列表，service.list() 无参 */
export function adminList<T>(
  service: { list: () => Promise<T[]> },
  logMsg: string
) {
  return adminHandler(async (req, res) => {
    const list = await service.list();
    success(res, list);
  }, logMsg);
}

/** GET /:id - 单个，service.get(id) */
export function adminGetById<T>(
  service: { get: (id: number) => Promise<T | null> },
  entityName: string,
  logMsg: string
) {
  return adminHandler(async (req, res) => {
    const id = parseIdParam(req, res, entityName);
    if (id == null) return;
    const item = await service.get(id);
    if (!item) {
      fail(res, ErrorCode.NOT_FOUND, `${entityName}不存在`);
      return;
    }
    success(res, item);
  }, logMsg);
}

/** DELETE /:id - 删除，service.delete(id) */
export function adminDelete(
  service: { delete: (id: number) => Promise<boolean> },
  entityName: string,
  logMsg: string
) {
  return adminHandler(async (req, res) => {
    const id = parseIdParam(req, res, entityName);
    if (id == null) return;
    const ok = await service.delete(id);
    if (ok) success(res, { message: '删除成功' });
    else fail(res, ErrorCode.NOT_FOUND, `${entityName}不存在`);
  }, logMsg);
}
