export enum ErrorCode {
  // 系统错误
  SYSTEM_ERROR = 50000,
  DATABASE_ERROR = 50001,
  
  // 业务错误
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
  USER_NOT_FOUND = 40010
}

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: any;
}

export class AppError extends Error {
  public code: ErrorCode;
  public cause?: any;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.code = options.code;
    this.cause = options.cause;
    this.name = 'AppError';
  }
}

export function createError(code: ErrorCode, message: string, cause?: any): AppError {
  return new AppError({ code, message, cause });
}