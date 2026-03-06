/**
 * API 响应数据校验中间件
 *
 * 仅在 development / test 环境启用。
 * 拦截 res.json()，对关键接口的返回数据做不变式校验。
 * 违反时输出 SCHEMA_VIOLATION 日志，不阻断请求。
 */
import { Request, Response, NextFunction } from 'express';
import { isEquipment } from '../utils/item-type';
import { logger } from '../utils/logger';

type RuleChecker = (data: any) => string[];

const RESPONSE_RULES: Record<string, RuleChecker> = {
  '/api/bag/list': (data) => {
    const errors: string[] = [];
    const items = data?.items || data || [];
    if (!Array.isArray(items)) return errors;
    for (const item of items) {
      if (item.equipment_uid && !isEquipment(item)) {
        errors.push(`物品 "${item.name}" (id=${item.item_id}) 有 equipment_uid 但 type=${item.type}, 预期为装备类型`);
      }
      if (isEquipment(item) && !item.equipment_uid) {
        errors.push(`装备 "${item.name}" (type=${item.type}) 缺少 equipment_uid`);
      }
      if ((item.count ?? 0) < 0) {
        errors.push(`物品 "${item.name}" count=${item.count} 为负`);
      }
    }
    return errors;
  },

  '/api/equip/list': (data) => {
    const errors: string[] = [];
    const equips = Array.isArray(data) ? data : [];
    for (const equip of equips) {
      if (!equip.equipment_uid) {
        errors.push(`装备栏物品 "${equip.name}" 缺少 equipment_uid`);
      }
      if (!equip.item_id) {
        errors.push(`装备栏物品 "${equip.name}" 缺少 item_id`);
      }
    }
    return errors;
  },

  '/api/player/get': (data) => {
    const errors: string[] = [];
    if (!data) return errors;
    if (typeof data.gold === 'number' && data.gold < 0) {
      errors.push(`金币为负: ${data.gold}`);
    }
    if (typeof data.hp === 'number' && data.hp < 0) {
      errors.push(`HP 为负: ${data.hp}`);
    }
    if (typeof data.mp === 'number' && data.mp < 0) {
      errors.push(`MP 为负: ${data.mp}`);
    }
    if (typeof data.level === 'number' && data.level < 1) {
      errors.push(`等级异常: ${data.level}`);
    }
    return errors;
  },

  '/api/shop/buy': (data) => {
    const errors: string[] = [];
    // buy 成功后 data 为 null，不需要特殊校验
    return errors;
  },

  '/api/auction/list': (data) => {
    const errors: string[] = [];
    const items = data?.items || [];
    if (!Array.isArray(items)) return errors;
    for (const item of items) {
      if (typeof item.price === 'number' && item.price <= 0) {
        errors.push(`拍卖品 "${item.name}" price=${item.price} 异常`);
      }
    }
    return errors;
  },
};

function matchRoute(path: string): RuleChecker | null {
  for (const [pattern, checker] of Object.entries(RESPONSE_RULES)) {
    if (path === pattern || path.startsWith(pattern + '?') || path.startsWith(pattern + '/')) {
      return checker;
    }
  }
  return null;
}

export function responseValidator(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    const checker = matchRoute(req.path);
    if (checker && body && body.code === 0 && body.data != null) {
      try {
        const errors = checker(body.data);
        if (errors.length > 0) {
          logger.error('SCHEMA_VIOLATION', {
            path: req.path,
            method: req.method,
            uid: (req as any).uid,
            errors,
          });

          if (process.env.NODE_ENV === 'test') {
            console.error(
              `\n[SCHEMA_VIOLATION] ${req.method} ${req.path}\n` +
              errors.map(e => `  - ${e}`).join('\n')
            );
          }
        }
      } catch (e) {
        // 校验器自身不应阻断请求
      }
    }
    return originalJson(body);
  } as any;

  next();
}
