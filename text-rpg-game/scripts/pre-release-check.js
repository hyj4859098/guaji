#!/usr/bin/env node
/**
 * 一键预发布检查
 *
 * 流水线：Lint → Build → Unit → Integration → Coverage Gate → E2E → Perf → Stress
 * 每步失败立即停止并输出原因。
 *
 * 用法：
 *   node scripts/pre-release-check.js              # 默认: 含 E2E quick
 *   node scripts/pre-release-check.js --full       # 全量: E2E full + 性能 + 压力
 *   node scripts/pre-release-check.js --skip-e2e   # 跳过 E2E 和性能/压力
 *   node scripts/pre-release-check.js --skip-perf  # 跳过性能/压力
 */
process.env.MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'turn-based-game-test';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const SCRIPTS = __dirname;

const args = process.argv.slice(2);
const isFull = args.includes('--full') || args.includes('--full-e2e');
const skipE2e = args.includes('--skip-e2e');
const skipPerf = args.includes('--skip-perf');

let stepNum = 0;
const startTime = Date.now();

function step(cmd, cwd, desc) {
  stepNum++;
  const label = `Step ${stepNum}: ${desc}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}\n`);

  const stepStart = Date.now();
  const r = spawnSync(cmd, [], { cwd, stdio: 'inherit', shell: true, env: process.env });
  const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);

  if (r.status !== 0) {
    console.error(`\n  FAILED: ${label} (${elapsed}s, exit ${r.status})`);
    console.error(`\n  Pre-release BLOCKED. Fix the issue above and re-run.\n`);
    process.exit(r.status || 1);
  }
  console.log(`  PASSED (${elapsed}s)`);
}

console.log('\n' + '='.repeat(60));
console.log('        PRE-RELEASE CHECK');
console.log('='.repeat(60));
console.log(`  Mode: ${isFull ? 'FULL' : skipE2e ? 'SKIP-E2E' : 'DEFAULT'}`);
console.log(`  DB:   ${process.env.MONGODB_DATABASE}`);
console.log('');

// 1. Lint
step('npm run lint', SERVER, 'Backend ESLint');
step('npm run lint:channel', SERVER, 'Data Channel Lint');
step('npm run lint:client', ROOT, 'Frontend ESLint');

// 2. Build
step('npm run build', SERVER, 'TypeScript Build');

// 3. Tests with coverage gate
step('npm run test:coverage', SERVER, 'Unit + Integration Tests (with coverage gate)');

// 4. E2E
if (!skipE2e) {
  step('npx playwright install chromium', ROOT, 'Install Playwright');
  if (isFull) {
    step('npx playwright test', ROOT, 'E2E Full Suite');
  } else {
    step('npm run e2e:quick', ROOT, 'E2E Quick Smoke');
  }
} else {
  console.log('\n  [SKIP] E2E tests (--skip-e2e)\n');
}

// 5. Performance & Stress (only in --full mode or explicitly)
if (isFull && !skipPerf) {
  step('node scripts/perf-baseline.js', ROOT, 'API Performance Baseline (P99 < 500ms)');
  step('node scripts/stress-test.js http://localhost:3000 20 15', ROOT, 'Stress Test (20 concurrent, 15s)');
} else if (!skipPerf && !skipE2e) {
  console.log('\n  [SKIP] Performance & Stress (use --full to include)\n');
}

// Done
const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
console.log('\n' + '='.repeat(60));
console.log(`  PRE-RELEASE CHECK PASSED (${totalElapsed}s)`);
console.log('='.repeat(60));
console.log('\n  Ready to release.');
console.log('  Checklist:');
console.log('    - .env JWT_SECRET configured for production');
console.log('    - MongoDB production instance ready');
console.log('    - Deployment script reviewed');
console.log('');
