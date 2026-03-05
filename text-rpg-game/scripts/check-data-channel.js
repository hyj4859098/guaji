#!/usr/bin/env node
/**
 * 数据通道混用检测
 * 规范：同一份数据只能使用一种通道（API 或 WebSocket），禁止混用
 * 允许：API 初始 + WS 推送（如 player/bag/equip）
 *
 * 检测内容：
 * 1. 提取客户端 API 调用（/xxx/list, /xxx/get 等）
 * 2. 提取客户端 WS 订阅类型
 * 3. 报告可能混用的数据域
 * 4. 检测轮询（setInterval/setTimeout 内调用 API）
 */

const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(__dirname, '../client');
const EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx'];

// 数据域映射：API 路径前缀 -> 域名
const API_TO_DOMAIN = {
  '/bag': 'bag',
  '/player': 'player',
  '/equip': 'equip',
  '/skill': 'skill',
  '/map': 'map',
  '/monster': 'monster',
  '/boss': 'boss',
  '/shop': 'shop',
  '/rank': 'rank',
  '/auction': 'auction',
  '/pvp': 'pvp',
  '/battle': 'battle',
};

// 允许的模式：API 初始 + WS 推送，或 API 操作 + WS 事件（不同数据）
const ALLOWED_OVERLAP = new Set(['bag', 'player', 'equip', 'boss', 'pvp', 'battle']);

function* walkDir(dir, base = '') {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = path.join(base, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'gm') continue;
      yield* walkDir(path.join(dir, e.name), rel);
    } else if (EXTENSIONS.some(ext => e.name.endsWith(ext))) {
      yield { rel, full: path.join(dir, e.name) };
    }
  }
}

function extractApiCalls(content, filePath) {
  const results = [];
  // API.get('/bag/list') 或 API.get(`/map/get?id=${id}`)
  const re = /API\.(get|post)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const endpoint = m[2].replace(/\$\{[^}]+\}/g, '').split('?')[0].trim();
    const domain = Object.keys(API_TO_DOMAIN).find(prefix => endpoint.startsWith(prefix));
    if (domain) {
      results.push({ domain: API_TO_DOMAIN[domain], endpoint, method: m[1], file: filePath });
    }
  }
  // API.get('/rank/list', { ... })
  const re2 = /API\.(get|post)\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g;
  while ((m = re2.exec(content)) !== null) {
    const endpoint = m[2].split('?')[0].trim();
    const domain = Object.keys(API_TO_DOMAIN).find(prefix => endpoint.startsWith(prefix));
    if (domain) {
      results.push({ domain: API_TO_DOMAIN[domain], endpoint, method: m[1], file: filePath });
    }
  }
  return results;
}

function extractWsSubscriptions(content, filePath) {
  const results = [];
  // WS.on('player', ...) 或 WS.on("bag", ...)
  const re = /WS\.on\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const type = m[1];
    // 映射 WS type 到域：player->player, bag->bag, equip->equip, pvp_map_players->pvp 等
    let domain = type;
    if (['player', 'bag', 'equip'].includes(type)) domain = type;
    else if (type.startsWith('pvp_')) domain = 'pvp';
    else if (type.startsWith('boss_')) domain = 'boss';
    else if (type.startsWith('battle') || type === 'boss_battle' || type === 'pvp_battle') domain = 'battle';
    results.push({ domain, type, file: filePath });
  }
  return results;
}

function detectPolling(content, filePath) {
  const results = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/setInterval|setTimeout/.test(line)) {
      // 简单检测：接下来几行或同一行是否有 API.get/post
      const block = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
      if (/API\.(get|post)\s*\(/.test(block)) {
        results.push({ file: filePath, line: i + 1, snippet: line.trim().slice(0, 80) });
      }
    }
  }
  return results;
}

function main() {
  const apiCalls = [];
  const wsSubs = [];
  const pollings = [];

  for (const { rel, full } of walkDir(CLIENT_DIR)) {
    const content = fs.readFileSync(full, 'utf8');
    apiCalls.push(...extractApiCalls(content, rel));
    wsSubs.push(...extractWsSubscriptions(content, rel));
    pollings.push(...detectPolling(content, rel));
  }

  // 去重并按域聚合
  const apiByDomain = new Map();
  for (const a of apiCalls) {
    if (!apiByDomain.has(a.domain)) apiByDomain.set(a.domain, new Set());
    apiByDomain.get(a.domain).add(JSON.stringify({ endpoint: a.endpoint, file: a.file }));
  }

  const wsByDomain = new Map();
  for (const w of wsSubs) {
    if (!wsByDomain.has(w.domain)) wsByDomain.set(w.domain, new Set());
    wsByDomain.get(w.domain).add(JSON.stringify({ type: w.type, file: w.file }));
  }

  // 报告
  console.log('=== 数据通道检测报告 ===\n');

  const overlapDomains = [...new Set([...apiByDomain.keys()].filter(d => wsByDomain.has(d)))];
  if (overlapDomains.length > 0) {
    console.log('【API + WebSocket 重叠的数据域】');
    for (const d of overlapDomains) {
      const status = ALLOWED_OVERLAP.has(d)
        ? '✓ 允许（API 初始/操作 + WS 推送/事件）'
        : '⚠ 请确认：是否为「API 初始 + WS 推送」？若存在轮询则违规';
      console.log(`  ${d}: ${status}`);
    }
    console.log('');
  }

  if (pollings.length > 0) {
    console.log('【可能的 API 轮询】');
    for (const p of pollings) {
      console.log(`  ${p.file}:${p.line}  ${p.snippet}...`);
    }
    console.log('');
  }

  console.log('【API 数据端点】');
  for (const [domain, set] of apiByDomain) {
    const items = [...set].map(s => JSON.parse(s));
    console.log(`  ${domain}: ${items.map(i => i.endpoint).join(', ')}`);
  }

  console.log('\n【WebSocket 订阅类型】');
  for (const [domain, set] of wsByDomain) {
    const items = [...set].map(s => JSON.parse(s));
    console.log(`  ${domain}: ${items.map(i => i.type).join(', ')}`);
  }

  const hasViolation = pollings.length > 0;
  process.exit(hasViolation ? 1 : 0);
}

main();
