import { IUserBase } from './index';
import { MailStatusEnum } from './enum';

export interface Mail extends IUserBase {
  title: string;
  content: string;
  reward: string;
  status: MailStatusEnum;
}
