// Exercise Changesets 3 in an isolated repository without publishing anything.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const fixture = mkdtempSync(join(tmpdir(), 'issue203-version-'));
const cli = resolve('node_modules/@changesets/cli/bin.js');
const config = JSON.parse(readFileSync('.changeset/config.json', 'utf8'));
try {
  mkdirSync(join(fixture, '.changeset'));
  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify({
      name: 'issue203-fixture',
      version: '1.0.0',
      devEngines: { packageManager: { name: 'npm' } },
    })
  );
  writeFileSync(
    join(fixture, '.changeset/config.json'),
    JSON.stringify(config)
  );
  writeFileSync(
    join(fixture, '.changeset/fix.md'),
    '---\n"issue203-fixture": patch\n---\n\nFix release reliability.\n'
  );
  execFileSync('git', ['init', '-q'], { cwd: fixture });
  execFileSync(process.execPath, [cli, 'version'], {
    cwd: fixture,
    stdio: 'inherit',
  });
  assert.equal(
    JSON.parse(readFileSync(join(fixture, 'package.json'), 'utf8')).version,
    '1.0.1'
  );
  assert.match(
    readFileSync(join(fixture, 'CHANGELOG.md'), 'utf8'),
    /Fix release reliability/
  );
  console.log('Changesets 3 version and changelog integration passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
