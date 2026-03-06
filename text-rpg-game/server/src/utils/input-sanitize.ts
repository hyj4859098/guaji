/**
 * 输入校验：防注入、长度限制、XSS 转义
 */
const USERNAME_MIN = 2;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;
const NAME_MAX = 32;

const SAFE_USERNAME = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;

export function sanitizeUsername(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < USERNAME_MIN || s.length > USERNAME_MAX) return null;
  if (!SAFE_USERNAME.test(s)) return null;
  return s;
}

export function sanitizePassword(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < PASSWORD_MIN || s.length > PASSWORD_MAX) return null;
  return s;
}

/** 角色名：字母数字中文下划线空格连字符，禁止 NoSQL 注入字符 $ . { } */
const SAFE_NAME = /^[a-zA-Z0-9_\u4e00-\u9fa5\s\-]+$/;

export function sanitizeName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < 1 || s.length > NAME_MAX) return null;
  if (!SAFE_NAME.test(s)) return null;
  return s;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** 转义 HTML 特殊字符，防止 XSS */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch] || ch);
}

/** 净化搜索关键词：去除 NoSQL 注入字符，限长 */
export function sanitizeKeyword(v: unknown, maxLen = 50): string {
  if (typeof v !== 'string') return '';
  return v.trim().replace(/[${}]/g, '').slice(0, maxLen);
}
