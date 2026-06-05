#!/usr/bin/env bun
/**
 * Project status script.
 * Reports on build state, file counts, test coverage, and NFR compliance.
 *
 * Usage: bun run scripts/status.ts
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

interface PackageInfo {
  name: string;
  type: 'app' | 'package' | 'test';
  files: number;
  srcFiles: number;
  testFiles: number;
  lines: number;
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  hasTests: boolean;
  hasReadme: boolean;
  hasDocker: boolean;
}

function walkDir(dir: string, ext: string[]): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.turbo' || entry.name === '.git') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

function countLines(files: string[]): number {
  return files.reduce((sum, f) => {
    try {
      return sum + readFileSync(f, 'utf-8').split('\n').length;
    } catch {
      return sum;
    }
  }, 0);
}

function inspectPackage(path: string, type: PackageInfo['type']): PackageInfo {
  const tsFiles = walkDir(path, ['.ts', '.tsx']);
  const testFiles = tsFiles.filter((f) => f.includes('.test.ts') || f.includes('.spec.ts'));
  const srcFiles = tsFiles.length - testFiles.length;
  const lines = countLines(tsFiles);

  return {
    name: path,
    type,
    files: tsFiles.length,
    srcFiles,
    testFiles: testFiles.length,
    lines,
    hasPackageJson: existsSync(join(path, 'package.json')),
    hasTsConfig: existsSync(join(path, 'tsconfig.json')),
    hasTests: testFiles.length > 0,
    hasReadme: existsSync(join(path, 'README.md')),
    hasDocker: existsSync(join(path, 'Dockerfile')),
  };
}

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Q-CMS — Project Status                            ║');
console.log('╚════════════════════════════════════════════════════╝\n');

const apps = ['apps/api', 'apps/admin', 'apps/worker', 'apps/collab', 'apps/cli']
  .filter((d) => existsSync(join(ROOT, d)))
  .map((d) => inspectPackage(d, 'app'));

const packages = readdirSync(join(ROOT, 'packages'))
  .filter((d) => statSync(join(ROOT, 'packages', d)).isDirectory())
  .map((d) => inspectPackage(join(ROOT, 'packages', d), 'package'));

const tests = readdirSync(join(ROOT, 'tests'))
  .filter((d) => statSync(join(ROOT, 'tests', d)).isDirectory())
  .map((d) => inspectPackage(join(ROOT, 'tests', d), 'test'));

const all = [...apps, ...packages, ...tests];

const total = {
  files: all.reduce((s, p) => s + p.files, 0),
  srcFiles: all.reduce((s, p) => s + p.srcFiles, 0),
  testFiles: all.reduce((s, p) => s + p.testFiles, 0),
  lines: all.reduce((s, p) => s + p.lines, 0),
};

console.log('📦 APPS');
console.log('─'.repeat(80));
console.log('  Package                          Files  Tests  Lines   Status');
for (const p of apps) {
  const status = [
    p.hasPackageJson ? '📋' : '·',
    p.hasTsConfig ? '⚙️ ' : '·',
    p.hasTests ? '✓' : '·',
  ].join('');
  console.log(
    `  ${p.name.padEnd(32)} ${String(p.files).padStart(4)}  ${String(p.testFiles).padStart(4)}  ${String(p.lines).padStart(6)}  ${status}`
  );
}

console.log('\n📚 PACKAGES');
console.log('─'.repeat(80));
console.log('  Package                          Files  Tests  Lines   Status');
for (const p of packages) {
  const status = [
    p.hasPackageJson ? '📋' : '·',
    p.hasTsConfig ? '⚙️ ' : '·',
    p.hasTests ? '✓' : '·',
  ].join('');
  console.log(
    `  ${p.name.padEnd(32)} ${String(p.files).padStart(4)}  ${String(p.testFiles).padStart(4)}  ${String(p.lines).padStart(6)}  ${status}`
  );
}

console.log('\n🧪 TESTS');
console.log('─'.repeat(80));
console.log('  Package                          Files  Tests  Lines   Status');
for (const p of tests) {
  const status = [
    p.hasPackageJson ? '📋' : '·',
    p.hasTsConfig ? '⚙️ ' : '·',
    p.hasTests ? '✓' : '·',
  ].join('');
  console.log(
    `  ${p.name.padEnd(32)} ${String(p.files).padStart(4)}  ${String(p.testFiles).padStart(4)}  ${String(p.lines).padStart(6)}  ${status}`
  );
}

console.log('\n📊 TOTALS');
console.log('─'.repeat(80));
console.log(`  Source files:    ${total.srcFiles}`);
console.log(`  Test files:      ${total.testFiles}`);
console.log(`  Total .ts/.tsx:  ${total.files}`);
console.log(`  Lines of code:   ${total.lines.toLocaleString()}`);
console.log(`  Test coverage:   ${total.testFiles} test files for ${total.srcFiles} source files`);

const testRatio = total.srcFiles > 0 ? total.testFiles / total.srcFiles : 0;
const testRatioPct = (testRatio * 100).toFixed(1);
console.log(`  Test:source ratio: ${testRatioPct}%`);

console.log('\n🎯 NFR TARGETS');
console.log('─'.repeat(80));
const nfrs = [
  { name: 'API p99 latency', target: '< 80ms', status: 'pending' },
  { name: 'API throughput', target: '≥ 5000 RPS / 2 vCPU', status: 'pending' },
  { name: 'Admin UI TTI', target: '< 1.5s', status: 'pending' },
  { name: 'Test coverage', target: '≥ 80%', status: testRatioPct >= '20.0' ? 'partial' : 'pending' },
  { name: 'Cold start', target: '< 500ms', status: 'pending' },
  { name: 'Bundle size', target: '≤ 250KB', status: 'pending' },
  { name: 'Zero-downtime deploy', target: 'required', status: 'pending' },
];
for (const nfr of nfrs) {
  const icon = nfr.status === 'pass' ? '✅' : nfr.status === 'partial' ? '🟡' : '⏳';
  console.log(`  ${icon} ${nfr.name.padEnd(28)} ${nfr.target}`);
}

console.log('\n📁 ROOT FILES');
console.log('─'.repeat(80));
const rootFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'biome.json',
  '.env.example',
  '.gitignore',
  'README.md',
  'PRD.md',
  'SPEC.md',
  'ARCHITECTURE.md',
  'DATA_MODEL.md',
  'API.md',
  'ROADMAP.md',
  'STACK.md',
  'docker-compose.yml',
  'Dockerfile.api',
  'Dockerfile.admin',
  'Dockerfile.worker',
  '.github/workflows/ci.yml',
];
for (const f of rootFiles) {
  const exists = existsSync(join(ROOT, f));
  console.log(`  ${exists ? '✓' : '·'} ${f}`);
}

console.log('\n');
