import { Response } from 'express';
import { ApiRes } from '../types/index';

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
 * 失败响应
 */
export function fail(res: Response, code: number, msg: string, data: any = null): void {
  const response: ApiRes = {
    code,
    msg,
    data
  };
  res.json(response);
}

/**
 * 错误响应（使用统一的错误代码）
 */
export function error(res: Response, code: number, msg: string): void {
  const response: ApiRes = {
    code,
    msg,
    data: null
  };
  res.json(response);
}
