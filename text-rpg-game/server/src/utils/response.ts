import { Response } from 'express';
import { ApiRes } from '../types/index';
import { ErrorCode } from './error';

export function toHttpStatus(code: number): number {
  if (code === ErrorCode.UNAUTHORIZED) return 401;
  if (code === ErrorCode.FORBIDDEN) return 403;
  if (code === ErrorCode.NOT_FOUND || code === ErrorCode.USER_NOT_FOUND
    || code === ErrorCode.ITEM_NOT_FOUND || code === ErrorCode.PLAYER_NOT_FOUND
    || code === ErrorCode.BOSS_NOT_FOUND || code === ErrorCode.AUCTION_NOT_FOUND) return 404;
  if (code >= 40000 && code < 50000) return 400;
  if (code >= 50000) return 500;
  return 400;
}

/**
 * 成功响应
 */
export function success<T>(res: Response, data: T, msg: string = 'success'): void {
  const response: ApiRes<T> = {
    code: 0,
    msg,
    data
  };
  res.json(response);
}

/**
 * 失败响应 — 自动根据业务错误码设置 HTTP 状态码
 */
export function fail(res: Response, code: number, msg: string, data: any = null): void {
  const response: ApiRes = {
    code,
    msg,
    data
  };
  res.status(toHttpStatus(code)).json(response);
}
