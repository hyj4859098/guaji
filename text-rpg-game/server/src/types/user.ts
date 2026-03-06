import { IBase } from './index';

export interface User extends IBase {
  username: string;
  password: string;
  is_admin?: boolean;
  login_ip?: string;
}
