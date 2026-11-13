// Run inside npm exec's pinned secretlint execution tree; use finite fixtures.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const scanner = resolve('scripts/check-secrets.mjs');
const config = readFileSync('.secretlintrc.json');
const root = mkdtempSync(join(tmpdir(), 'issue-299-secrets-'));
try {
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
  writeFileSync(join(root, '.secretlintrc.json'), config);
  writeFileSync(
    join(root, 'evidence.log'),
    `token=gh${'p_'}${'A'.repeat(36)}\n`
  );
  writeFileSync(
    join(root, 'evidence.log.gz'),
    gzipSync(readFileSync(join(root, 'evidence.log')))
  );
  execFileSync('tar', ['-czf', 'evidence.tgz', 'evidence.log'], { cwd: root });
  execFileSync('tar', ['-czf', 'evidence.tar.gz', 'evidence.log'], {
    cwd: root,
  });
  rmSync(join(root, 'evidence.log'));
  for (const file of ['evidence.log.gz', 'evidence.tgz', 'evidence.tar.gz']) {
    execFileSync('git', ['add', '--', file], { cwd: root });
    const baseline = spawnSync('secretlint', ['--no-glob', file], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(baseline.status, 0, baseline.stderr);
    const fixed = spawnSync(process.execPath, [scanner], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(fixed.status, 1, fixed.stderr);
    assert.match(fixed.stdout + fixed.stderr, /GitHub|GitHubToken/i);
    console.log(
      `${file}: raw compressed scan accepted; fixed scanner rejected secret`
    );
    execFileSync('git', ['rm', '--cached', '--', file], {
      cwd: root,
      stdio: 'ignore',
    });
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
