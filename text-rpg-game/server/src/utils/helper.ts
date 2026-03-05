import jwt from 'jsonwebtoken';

export function getCurrentTime(): number {
  return Math.floor(Date.now() / 1000);
}

export function generateToken(uid: number | string, secret: string): string {
  return jwt.sign({ uid }, secret, { expiresIn: '7d' });
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
