import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

const WORKFLOWS = '.github/workflows';

function readWorkflow(file) {
  return readFileSync(join(WORKFLOWS, file), 'utf8').replaceAll('\r\n', '\n');
}

function jobBlocks(workflow) {
  const body = workflow.slice(workflow.indexOf('\njobs:\n'));
  return body.split(/\n(?= {2}[\w-]+:\n)/).slice(1);
}

function stepScript(job, name) {
  const step = job.split(`- name: ${name}\n`)[1].split('\n      - ')[0];
  const lines = step.split('run: |\n')[1].split('\n');
  return lines
    .filter((line) => line.startsWith('          ') || line === '')
    .map((line) => line.slice(10))
    .join('\n');
}

const containerJobs = readdirSync(WORKFLOWS)
  .filter((file) => /\.ya?ml$/.test(file))
  .flatMap((file) =>
    jobBlocks(readWorkflow(file))
      .filter((job) => /^ {4}container:/m.test(job))
      .map((job) => ({ file, name: job.split(':')[0].trim(), job }))
  );

describe('container jobs', () => {
  it('include the preview-image job', () => {
    expect(containerJobs.map(({ name }) => name)).toContain('preview-regen');
  });

  it('run scripts with bash and trust the checkout', () => {
    for (const { file, name, job } of containerJobs) {
      const where = `${file} ${name}`;
      expect(`${where}\n${job}`).toMatch(
        /\n {4}defaults:\n {6}run:\n {8}shell: bash\n/
      );
      expect(`${where}\n${job}`).toContain(
        'git config --global --add safe.directory "$GITHUB_WORKSPACE"'
      );
    }
  });
});

describe('preview drift detection', () => {
  const job = containerJobs.find(({ name }) => name === 'preview-regen').job;
  const script = stepScript(job, 'Detect drift');

  itUnless(sandboxed, noPosixShell)(
    'reports only the preview outcome that actually happened',
    () => {
      const summary = stepScript(job, 'Summarize regeneration result');
      const scenarios = [
        [{ REGENERATE: 'failure' }, 'not regenerated'],
        [
          { REGENERATE: 'success', DRIFT_OUTCOME: 'failure' },
          'could not be checked',
        ],
        [
          { REGENERATE: 'success', DRIFT_OUTCOME: 'success', DRIFT: 'false' },
          'already up to date',
        ],
        [
          {
            REGENERATE: 'success',
            DRIFT_OUTCOME: 'success',
            DRIFT: 'true',
            COMMIT: 'success',
            LANDED: 'true',
          },
          'were committed',
        ],
        [
          {
            REGENERATE: 'success',
            DRIFT_OUTCOME: 'success',
            DRIFT: 'true',
            COMMIT: 'failure',
          },
          'were not committed',
        ],
        [
          {
            REGENERATE: 'success',
            DRIFT_OUTCOME: 'success',
            DRIFT: 'true',
            COMMIT: 'success',
          },
          'were not committed',
        ],
      ];
      for (const [env, message] of scenarios) {
        const result = spawnSync('bash', ['-eu', '-c', summary], {
          encoding: 'utf8',
          env: {
            ...process.env,
            REGENERATE: '',
            DRIFT_OUTCOME: '',
            DRIFT: '',
            COMMIT: '',
            LANDED: '',
            ...env,
          },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(message);
      }
    }
  );

  function detect(setup) {
    const root = mkdtempSync(join(tmpdir(), 'preview-drift-'));
    const dir = join(root, 'checkout');
    try {
      mkdirSync(dir);
      setup(dir);
      const output = join(root, 'output');
      writeFileSync(output, '');
      const result = spawnSync('bash', ['-e', '-c', script], {
        cwd: dir,
        encoding: 'utf8',
        // Stop git from finding a repository above the fixture.
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          GIT_CEILING_DIRECTORIES: root,
        },
      });
      return { ...result, output: readFileSync(output, 'utf8') };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const git = (dir, ...args) =>
    spawnSync('git', args, { cwd: dir, encoding: 'utf8' });

  itUnless(sandboxed, noPosixShell)(
    'fails when git cannot read the checkout',
    () => {
      // A directory outside any repository fails git status the way the
      // untrusted container checkout did.
      const result = detect(() => {});
      expect(result.status).not.toBe(0);
      expect(result.output).toBe('');
      expect(result.stdout).not.toContain('already current');
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'reports drift in a changed checkout',
    () => {
      const result = detect((dir) => {
        git(dir, 'init', '-q');
        writeFileSync(join(dir, 'preview.png'), 'changed');
      });
      expect(result.status).toBe(0);
      expect(result.output).toBe('drift=true\n');
      expect(result.stdout).toContain('?? preview.png');
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'reports a clean checkout as current',
    () => {
      const result = detect((dir) => {
        git(dir, 'init', '-q');
      });
      expect(result.status).toBe(0);
      expect(result.output).toBe('drift=false\n');
      expect(result.stdout).toContain('Preview images already current.');
    }
  );
});
