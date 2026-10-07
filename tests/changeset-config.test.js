import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { describe, it, expect } from 'test-anywhere';

const config = JSON.parse(readFileSync('.changeset/config.json', 'utf8'));

describe('Changesets release formatter', () => {
  it('uses the same formatter as the project formatting check', () => {
    expect(config.format).toBe('prettier');
  });

  it('references the release Changesets config schema', () => {
    // Deno installs dependencies lazily; this read-only job never runs Changesets.
    const isDeno = typeof Deno !== 'undefined';
    const metadata = JSON.parse(
      readFileSync(
        isDeno
          ? 'package-lock.json'
          : 'node_modules/@changesets/config/package.json',
        'utf8'
      )
    );
    const version = isDeno
      ? metadata.packages['node_modules/@changesets/config'].version
      : metadata.version;
    expect(config.$schema).toBe(
      `https://unpkg.com/@changesets/config@${version}/schema.json`
    );
  });

  if (typeof Deno !== 'undefined') {
    return; // Deno's test job grants read permission only, without subprocesses.
  }

  it('versions and formats the real package with Deno absent from PATH', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'changeset-version-'));
    try {
      for (const file of [
        'package.json',
        'deno.json',
        'deno.lock',
        '.prettierrc',
      ]) {
        copyFileSync(file, join(cwd, file));
      }
      mkdirSync(join(cwd, '.changeset'));
      copyFileSync(
        '.changeset/config.json',
        join(cwd, '.changeset/config.json')
      );
      // Match the Linux release runner even when the checkout uses Windows CRLF.
      const manifest = readFileSync(
        join(cwd, 'package.json'),
        'utf8'
      ).replaceAll('\r\n', '\n');
      writeFileSync(join(cwd, 'package.json'), manifest);
      const pkg = JSON.parse(manifest);
      writeFileSync(
        join(cwd, '.changeset/release-check.md'),
        `---\n"${pkg.name}": patch\n---\n\nCheck release versioning.\n`
      );
      writeFileSync(join(cwd, 'CHANGELOG.md'), `# ${pkg.name}\n`);
      symlinkSync(
        resolve('node_modules'),
        join(cwd, 'node_modules'),
        'junction'
      );
      const env = { ...process.env };
      const pathKey = Object.keys(env).find(
        (key) => key.toUpperCase() === 'PATH'
      );
      assert.ok(pathKey, 'The release fixture needs Node and npm on PATH');
      env[pathKey] = env[pathKey]
        .split(delimiter)
        .filter(
          (dir) =>
            !['deno', 'deno.exe', 'deno.cmd'].some((name) =>
              existsSync(join(dir, name))
            )
        )
        .join(delimiter);
      assert.equal(
        spawnSync('deno', ['--version'], { env }).error?.code,
        'ENOENT'
      );
      const run = (file, args) => {
        const result = spawnSync('node', [resolve(file), ...args], {
          cwd,
          env,
          encoding: 'utf8',
          timeout: 20000,
        });
        assert.equal(
          result.status,
          0,
          `${result.error || ''}\n${result.stdout}\n${result.stderr}`
        );
      };
      run('node_modules/@changesets/cli/bin.js', ['version']);
      const versionParts = pkg.version.split('.').map(Number);
      versionParts[2] += 1;
      expect(
        JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version
      ).toBe(versionParts.join('.'));
      expect(existsSync(join(cwd, '.changeset/release-check.md'))).toBe(false);
      expect(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8')).toContain(
        'Check release versioning.'
      );
      run('node_modules/prettier/bin/prettier.cjs', [
        '--check',
        'package.json',
        'CHANGELOG.md',
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('credential-free PR release versioning', () => {
  it('checks the fresh merge in the independent lint job and discards changes', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const lint = workflow.split('\n  lint:')[1].split('\n  test:')[0];
    expect(lint).toContain('needs: [detect-changes]');
    expect(lint).toContain('Dry-run release versioning');
    expect(lint).toContain('npm run changeset:version');
    expect(lint).toContain(
      "trap 'git restore --source=HEAD --staged --worktree -- .' EXIT"
    );
    expect(lint.indexOf('Dry-run release versioning')).toBeGreaterThan(
      lint.indexOf('Simulate fresh merge')
    );
  });
});
