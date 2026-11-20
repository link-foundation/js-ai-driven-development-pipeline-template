#!/usr/bin/env node

// Run the same pinned scanner as CI against finite, synthetic evidence.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';

const workflow = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
const scan = workflow.jobs.lint.steps.find(
  ({ name }) => name === 'Check for secrets'
);
const version = scan.run.match(/\bsecretlint@(\d+\.\d+\.\d+)\b/)[1];
const script = resolve('scripts/check-secrets.mjs');
const cwd = mkdtempSync(join(tmpdir(), 'issue-212-secretlint-'));
const git = (...args) => execFileSync('git', args, { cwd });
const clean = 'This file has no credentials.\n';
const tokens = {
  github: `ghp_${'A'.repeat(36)}\n`,
  slack: `xoxb-${'1'.repeat(12)}-${'2'.repeat(12)}-${'a'.repeat(24)}\n`,
};

function verify(label, plain, zipped, expected) {
  writeFileSync(join(cwd, 'plain.txt'), plain);
  writeFileSync(join(cwd, 'compressed.txt.gz'), gzipSync(zipped));
  git('add', '.');
  const result = spawnSync(
    'npm',
    [
      'exec',
      '--yes',
      '--package',
      `secretlint@${version}`,
      '--',
      'node',
      script,
    ],
    { cwd, encoding: 'utf8', shell: process.platform === 'win32' }
  );
  assert.equal(
    result.status,
    expected,
    `${label}: ${result.stderr || result.stdout || result.error}`
  );
  console.log(`${label}: expected scanner exit ${result.status}`);
}

try {
  git('init', '-q');
  copyFileSync('.secretlintrc.json', join(cwd, '.secretlintrc.json'));
  verify('clean', clean, clean, 0);
  for (const [name, token] of Object.entries(tokens)) {
    verify(`plain ${name}`, token, clean, 1);
    verify(`gzip ${name}`, clean, token, 1);
  }
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
