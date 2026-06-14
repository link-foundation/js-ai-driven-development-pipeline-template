import { describe, it, expect } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('../scripts/detect-code-changes.mjs', import.meta.url)
);
const isDenoRuntime = typeof Deno !== 'undefined';
const canRunCliFixtures =
  !isDenoRuntime && typeof process !== 'undefined' && process.execPath;

function runGit(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${
        result.stderr
      }`
    );
  }
}

function commit(root, message) {
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-m', message]);
}

function createMergeCommitFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'detect-code-changes-'));

  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'ci@example.com']);
  runGit(root, ['config', 'user.name', 'CI Test']);

  writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
  commit(root, 'Initial commit');

  runGit(root, ['checkout', '-b', 'feature']);
  mkdirSync(path.join(root, 'src'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'index.mjs'),
    'export const value = 1;\n'
  );
  commit(root, 'Add source change');

  mkdirSync(path.join(root, 'docs'), { recursive: true });
  writeFileSync(path.join(root, 'docs', 'notes.md'), '# Notes\n');
  commit(root, 'Add docs change');

  runGit(root, ['checkout', 'main']);
  runGit(root, ['merge', '--no-ff', 'feature', '-m', 'Merge feature']);

  return root;
}

function runDetectCodeChanges(root, eventName) {
  const outputFile = path.join(root, 'github-output.txt');
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_OUTPUT: outputFile,
    },
  });

  return {
    outputs: readFileSync(outputFile, 'utf8'),
    result,
  };
}

describe('detect-code-changes CLI', () => {
  if (canRunCliFixtures) {
    it('detects code introduced by a real merge commit pushed to main', () => {
      const root = createMergeCommitFixture();

      try {
        const { outputs, result } = runDetectCodeChanges(root, 'push');

        expect(result.status).toBe(0);
        expect(outputs).toContain('mjs-changed=true\n');
        expect(outputs).toContain('docs-changed=true\n');
        expect(outputs).toContain('any-code-changed=true\n');
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    });

    it('keeps pull request merge commits scoped to the PR head commit diff', () => {
      const root = createMergeCommitFixture();

      try {
        const { outputs, result } = runDetectCodeChanges(root, 'pull_request');

        expect(result.status).toBe(0);
        expect(outputs).toContain('mjs-changed=false\n');
        expect(outputs).toContain('docs-changed=true\n');
        expect(outputs).toContain('any-code-changed=false\n');
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    });
  }
});
