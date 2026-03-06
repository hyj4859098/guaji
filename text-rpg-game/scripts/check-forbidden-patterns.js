#!/usr/bin/env node
/**
 * 通用禁止模式扫描器
 * 读取 forbidden-patterns.json 配置，扫描代码中的违规模式。
 * 用于 CI 和 pre-commit，防止"改了一处漏了其他处"。
 *
 * 扩展方式：只需往 forbidden-patterns.json 加新规则，不需要改本脚本。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'forbidden-patterns.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`配置文件不存在: ${CONFIG_PATH}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function matchGlob(filePath, pattern) {
  const normalized = filePath.replace(/\\/g, '/');
  const pat = pattern.replace(/\\/g, '/');

  if (pat.endsWith('/**')) {
    const prefix = pat.slice(0, -3);
    return normalized.startsWith(prefix + '/') || normalized === prefix;
  }
  if (pat.includes('**')) {
    const parts = pat.split('**');
    if (parts.length === 2) {
      const prefix = parts[0];
      const suffix = parts[1];
      if (!normalized.startsWith(prefix)) return false;
      const rest = normalized.slice(prefix.length);
      if (suffix.startsWith('/')) {
        const ext = suffix.slice(1);
        if (ext.startsWith('*.')) {
          return rest.endsWith(ext.slice(1));
        }
        return rest.includes(suffix);
      }
      return true;
    }
  }
  if (pat.startsWith('*.')) {
    return normalized.endsWith(pat.slice(1));
  }
  return normalized === pat || normalized.endsWith('/' + pat);
}

function* walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'playwright-report', 'coverage'].includes(entry.name)) continue;
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}

function getRelativePath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function isWhitelisted(relPath, whitelist) {
  for (const w of whitelist) {
    const wNorm = w.replace(/\\/g, '/');
    if (wNorm.includes('**')) {
      if (matchGlob(relPath, wNorm)) return true;
    } else if (relPath.includes(wNorm)) {
      return true;
    }
  }
  return false;
}

function scanFile(filePath, regex) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
    if (regex.test(line)) {
      hits.push({ line: i + 1, text: line.trim().slice(0, 120) });
    }
    regex.lastIndex = 0;
  }
  return hits;
}

function collectFiles(scanGlobs) {
  const files = new Set();
  for (const glob of scanGlobs) {
    const normalized = glob.replace(/\\/g, '/');
    const baseDir = normalized.split('*')[0].replace(/\/$/, '') || '.';
    const absBase = path.resolve(ROOT, baseDir);
    for (const absFile of walkDir(absBase)) {
      const rel = getRelativePath(absFile);
      if (matchGlob(rel, normalized)) {
        files.add(rel);
      }
    }
  }
  return [...files];
}

function main() {
  const rules = loadConfig();
  let totalViolations = 0;
  const reports = [];

  for (const rule of rules) {
    const { id, description, pattern, scan, whitelist = [], suggestion } = rule;
    const regex = new RegExp(pattern, 'g');
    const files = collectFiles(scan);
    const violations = [];

    for (const relPath of files) {
      if (isWhitelisted(relPath, whitelist)) continue;
      const absPath = path.resolve(ROOT, relPath);
      const hits = scanFile(absPath, regex);
      for (const hit of hits) {
        violations.push({ file: relPath, ...hit });
      }
    }

    if (violations.length > 0) {
      totalViolations += violations.length;
      reports.push({ id, description, suggestion, violations });
    }
  }

  console.log('=== 禁止模式扫描报告 ===\n');

  if (reports.length === 0) {
    console.log('通过：未发现违规模式\n');
    process.exit(0);
  }

  for (const report of reports) {
    console.log(`[${report.id}] ${report.description}`);
    console.log(`  修复建议: ${report.suggestion}`);
    for (const v of report.violations) {
      console.log(`  ${v.file}:${v.line}  ${v.text}`);
    }
    console.log('');
  }

  console.log(`共 ${totalViolations} 处违规，请按建议修复后再提交。`);
  process.exit(1);
}

main();
