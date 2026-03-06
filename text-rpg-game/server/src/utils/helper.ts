import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export function getCurrentTime(): number {
  return Math.floor(Date.now() / 1000);
}

export function generateToken(uid: number | string, secret: string): string {
  const opts: SignOptions = { expiresIn: config.jwt_expire as SignOptions['expiresIn'], algorithm: 'HS256' };
  return jwt.sign({ uid }, secret, opts);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export { toUidKey } from './uid-key';
