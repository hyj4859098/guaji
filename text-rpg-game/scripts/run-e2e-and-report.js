#!/usr/bin/env node
/**
 * 运行 E2E 并输出结果到文件，便于 CI/自动化读取
 * 用法：node scripts/run-e2e-and-report.js [spec文件]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'test-results', 'e2e-report.txt');
const JSON_RESULT = path.join(ROOT, 'test-results', 'e2e-result.json');

const spec = process.argv[2] || '';
const cmd = spec ? `npx playwright test ${spec}` : 'npx playwright test';

console.log('Running:', cmd);
const r = spawnSync(cmd, [], { cwd: ROOT, shell: true, stdio: 'inherit' });

let summary = `Exit: ${r.status}\nTime: ${new Date().toISOString()}\n`;
if (fs.existsSync(JSON_RESULT)) {
  try {
    const j = JSON.parse(fs.readFileSync(JSON_RESULT, 'utf8'));
    const passed = j.stats?.expected || 0;
    const failed = j.stats?.unexpected || 0;
    const flaky = j.stats?.flaky || 0;
    summary += `Passed: ${passed} Failed: ${failed} Flaky: ${flaky}\n`;
    if (failed > 0 && Array.isArray(j.suites)) {
      const fails = [];
      function collectFailures(s) {
        (s.specs || []).forEach(sp => {
          (sp.tests || []).forEach(t => {
            if (t.results?.some(r => r.status === 'unexpected')) {
              fails.push(`${sp.title}: ${t.results?.find(r => r.status === 'unexpected')?.error?.message?.slice(0, 80) || 'failed'}`);
            }
          });
        });
        (s.suites || []).forEach(collectFailures);
      }
      collectFailures(j);
      if (fails.length) summary += 'Failures:\n' + fails.slice(0, 5).join('\n') + '\n';
    }
  } catch (_) {}
}

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, summary, 'utf8');
console.log('\nReport written to:', REPORT);

process.exit(r.status || 0);
