export enum ErrorCode {
  // 系统错误
  SYSTEM_ERROR = 50000,
  DATABASE_ERROR = 50001,
  
  // 通用业务错误
  INVALID_PARAMS = 40000,
  NOT_FOUND = 40001,
  UNAUTHORIZED = 40002,
  FORBIDDEN = 40003,
  ITEM_NOT_FOUND = 40004,
  ITEM_COUNT_NOT_ENOUGH = 40005,
  ITEM_NOT_EQUIPMENT = 40006,
  EQUIP_POSITION_OCCUPIED = 40007,
  BAG_FULL = 40008,
  BAG_EQUIPMENT_FULL = 40011,
  LEVEL_NOT_ENOUGH = 40009,
  USER_NOT_FOUND = 40010,

  // Boss
  BOSS_NOT_FOUND = 40100,
  BOSS_DEAD = 40101,
  BOSS_BUSY = 40102,

  // 交易
  TRADE_INVALID = 40200,
  TRADE_PARTNER_UNAVAILABLE = 40201,
  TRADE_INSUFFICIENT_FUNDS = 40202,
  TRADE_ITEM_MISSING = 40203,

  // 拍卖
  AUCTION_NOT_FOUND = 40300,
  AUCTION_SOLD_OUT = 40301,
  AUCTION_SELF_BUY = 40302,

  // 战斗
  BATTLE_IN_PROGRESS = 40400,
  BATTLE_PLAYER_DEAD = 40401,

  // 玩家
  PLAYER_NOT_FOUND = 40500,
  GOLD_NOT_ENOUGH = 40501,
}

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: unknown;
}

export class AppError extends Error {
  public code: ErrorCode;
  public declare cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.code = options.code;
    this.cause = options.cause;
    this.name = 'AppError';
  }
}

export function createError(code: ErrorCode, message: string, cause?: unknown): AppError {
  return new AppError({ code, message, cause });
}