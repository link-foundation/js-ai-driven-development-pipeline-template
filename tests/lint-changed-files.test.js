import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import {
  changesLintConfig,
  filterWarningsToChangedFiles,
  lintExitCode,
} from '../scripts/lint-changed-files.mjs';

describe('changed-file lint warning scope', () => {
  it('keeps warnings on the unchanged function header of a changed file', () => {
    const cwd = resolve('repo');
    const file = 'scripts/example.mjs';
    const warning = { severity: 1, line: 1, ruleId: 'complexity' };
    const result = {
      filePath: join(cwd, file),
      messages: [warning],
      errorCount: 0,
      warningCount: 1,
    };
    expect(
      filterWarningsToChangedFiles([result], new Set([file]), cwd)
    ).toEqual([result]);
  });

  it('drops warnings from untouched files and always keeps errors', () => {
    const cwd = resolve('repo');
    const error = { severity: 2, line: 5 };
    const [result] = filterWarningsToChangedFiles(
      [
        {
          filePath: join(cwd, 'other.mjs'),
          messages: [error, { severity: 1, line: 1 }],
          errorCount: 1,
          warningCount: 1,
          fixableWarningCount: 1,
        },
      ],
      new Set(['example.mjs']),
      cwd
    );
    expect(result.messages).toEqual([error]);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);
    expect(result.fixableWarningCount).toBe(0);
  });

  it('expands the scope when ESLint config, a local rule or npm metadata changes', () => {
    for (const file of [
      'eslint.config.js',
      'eslint.config.mts',
      'eslint-rules/local/rule.mjs',
      'package.json',
      'package-lock.json',
    ]) {
      expect(changesLintConfig(new Set(['src/a.js', file]))).toBe(true);
    }
    expect(changesLintConfig(new Set(['src/a.js']))).toBe(false);
  });
});

describe('lint entry point', () => {
  it('fails a body-only edit that raises function complexity', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'lint-changed-files-'));
    const git = (...args) =>
      execFileSync('git', args, { cwd, encoding: 'utf8' });
    const pick = (body) => `export function pick(x) {\n${body}  return x;\n}\n`;

    try {
      git('init', '-q', '-b', 'main');
      mkdirSync(join(cwd, 'scripts'));
      symlinkSync(
        resolve('node_modules'),
        join(cwd, 'node_modules'),
        'junction'
      );
      for (const script of ['lint.mjs', 'lint-changed-files.mjs']) {
        copyFileSync(join('scripts', script), join(cwd, 'scripts', script));
      }
      writeFileSync(join(cwd, '.gitignore'), 'node_modules/\n');
      writeFileSync(join(cwd, 'package.json'), '{"type":"module"}');
      writeFileSync(
        join(cwd, 'eslint.config.js'),
        'export default [{ rules: { complexity: ["warn", 1] } }];'
      );
      const source = join(cwd, 'pick.js');
      writeFileSync(source, pick(''));
      git('add', '.');
      git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.org',
        'commit',
        '-qm',
        'base'
      );

      const lint = () =>
        spawnSync('node', ['scripts/lint.mjs'], {
          cwd,
          encoding: 'utf8',
          env: {
            ...process.env,
            LINT_ALL_WARNINGS: '0',
            LINT_BASE_REF: 'main',
          },
        });
      const baseline = lint();
      expect(baseline.status).toBe(0);
      writeFileSync(source, pick('  if (x === 1) return 0;\n'));
      expect(git('diff', '--unified=0')).toContain('@@ -1,0 +2 @@');
      const changed = lint();
      expect(changed.stdout).toContain('1:8  warning');
      expect(changed.stdout).toContain('complexity of 2');
      expect(changed.status).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('lintExitCode', () => {
  const result = (errorCount, warningCount) => ({ errorCount, warningCount });

  it('passes only when nothing is reported', () => {
    expect(lintExitCode([result(0, 0), result(0, 0)])).toBe(0);
    expect(lintExitCode([])).toBe(0);
  });

  it('fails on a reported warning, as the pre-commit hook does', () => {
    expect(lintExitCode([result(0, 0), result(0, 1)])).toBe(1);
  });

  it('fails on an error', () => {
    expect(lintExitCode([result(1, 0)])).toBe(1);
  });

  it('reports every warning on pushes to main', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const step = workflow.split('- name: Run ESLint')[1].split('- name:')[0];
    expect(step).toContain(
      "LINT_ALL_WARNINGS: ${{ github.event_name != 'pull_request' && '1' || '0' }}"
    );
    expect(step).toContain('run: npm run lint');
  });
});

describe('eslint.config.js', () => {
  it('imports only packages that package.json declares', () => {
    // ESLint 9 hoisted @eslint/js, so an undeclared import still resolved;
    // ESLint 10 no longer depends on it.
    const config = readFileSync('eslint.config.js', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    const imported = [...config.matchAll(/from '([^.][^']*)'/g)].map(
      ([, spec]) =>
        spec
          .split('/')
          .slice(0, spec.startsWith('@') ? 2 : 1)
          .join('/')
    );

    expect(imported).toContain('@eslint/js');
    for (const name of imported) {
      expect(`${name} ${typeof declared[name]}`).toBe(`${name} string`);
    }
  });
});
