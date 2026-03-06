export type Id = number;
export type Uid = number | string;
export type Time = number;

export interface IBase {
  id: Id;
  create_time: Time;
  update_time: Time;
}

export interface IUserBase extends IBase {
  uid: Uid;
}

export interface ApiRes<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

export interface Page<T = unknown> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

export interface IBaseService<T extends IBase> {
  get(id: Id): Promise<T | null>;
  list(uid?: Uid): Promise<T[]>;
  add(data: Omit<T, 'id' | 'create_time' | 'update_time'>): Promise<Id>;
  update(id: Id, data: Partial<T>): Promise<boolean>;
  delete(id: Id): Promise<boolean>;
}

export interface IBaseModel<T extends IBase> {
  get(id: Id): Promise<T | null>;
  listByUid?(uid: Uid): Promise<T[]>;
  insert(data: Partial<Omit<T, 'id' | 'create_time' | 'update_time'>> & Record<string, unknown>): Promise<Id>;
  update(id: Id, data: Partial<T>): Promise<boolean>;
  delete(id: Id): Promise<boolean>;
}
