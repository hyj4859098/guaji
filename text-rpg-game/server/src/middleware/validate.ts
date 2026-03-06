import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { fail } from '../utils/response';
import { ErrorCode } from '../utils/error';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const issues = result.error.issues;
      const first = issues[0];
      const path = first?.path?.length ? first.path.join('.') + ': ' : '';
      const msg = path + (first?.message || '参数无效');
      return fail(res, ErrorCode.INVALID_PARAMS, msg);
    }
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
