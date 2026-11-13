import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'test-anywhere';
import { parse } from 'yaml';
import {
  validatePackReport,
  checkNpmTarballSize,
  MAX_TARBALL_BYTES,
  reportNpmTarballSizeError,
} from '../scripts/check-npm-tarball-size.mjs';
import {
  isNonRetryableFailure,
  buildPublishFailureGuidance,
} from '../scripts/publish-failure-classifier.mjs';
import { publishWithRetry } from '../scripts/publish-retry.mjs';

const workflow = (name) =>
  parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));
const pack = (size = 1) => [
  {
    name: 'fixture',
    size,
    files: [
      { path: 'small.js', size: 1 },
      { path: 'binary', size: 200 },
    ],
  },
];
describe('issue 299 workflow regressions', () => {
  it('sets init.defaultBranch in every workflow with checkout', () => {
    for (const file of readdirSync('.github/workflows')) {
      const text = readFileSync(`.github/workflows/${file}`, 'utf8');
      if (text.includes('actions/checkout@')) {
        assert.deepEqual(
          Object.fromEntries(
            Object.entries(parse(text).env).filter(([key]) =>
              key.startsWith('GIT_CONFIG_')
            )
          ),
          {
            GIT_CONFIG_COUNT: '1',
            GIT_CONFIG_KEY_0: 'init.defaultBranch',
            GIT_CONFIG_VALUE_0: 'main',
          },
          file
        );
      }
    }
  });
  it('runs the pinned ShellCheck in a venv over scripts and hooks', () => {
    const command = workflow('workflows').jobs.shellcheck.steps.at(-1).run;
    assert.match(command, /python3 -m venv/);
    assert.match(command, /shellcheck-py==0\.11\.0\.1/);
    assert.match(command, /git ls-files -z '\*\.sh' '\.husky\/\*'/);
    assert.match(
      command,
      /xargs -0 "\$RUNNER_TEMP\/shellcheck-venv\/bin\/shellcheck"/
    );
    assert.doesNotMatch(command, /pipx/);
  });
  it('restores PR link caches but saves only main pushes', () => {
    const steps =
      workflow('links').jobs['link-check']?.steps ??
      Object.values(workflow('links').jobs)[0].steps;
    assert.ok(steps.some((step) => step.uses === 'actions/cache/restore@v5'));
    const save = steps.find((step) => step.uses === 'actions/cache/save@v5');
    assert.match(save.if, /github.event_name == 'push'/);
    assert.match(save.if, /github.ref == 'refs\/heads\/main'/);
    assert.match(save.if, /cache-hit != 'true'/);
    assert.ok(!steps.some((step) => step.uses === 'actions/cache@v5'));
    assert.ok(
      !workflow('release').jobs['docker-build'].steps.some(
        (step) => step.with?.['cache-to']
      )
    );
  });
  it('runs secrets with pinned packages and checks tarball size on PRs', () => {
    const steps = workflow('release').jobs.lint.steps;
    const scan = steps.find((step) => step.name === 'Check for secrets');
    assert.match(scan.run, /secretlint@13\.0\.7/);
    assert.match(scan.run, /node scripts\/check-secrets.mjs/);
    const gate = steps.find(
      (step) => step.run === 'node scripts/check-npm-tarball-size.mjs'
    );
    assert.ok(gate);
    assert.equal(gate.if, undefined);
    assert.ok(
      readFileSync('scripts/publish-to-npm.mjs', 'utf8').includes(
        'checkNpmTarballSize({ cwd: jsRoot'
      )
    );
  });
});
describe('npm tarball size and permanent failures', () => {
  it('accepts the boundary and reports compressed size and largest unpacked files', () => {
    validatePackReport(pack(MAX_TARBALL_BYTES));
    assert.throws(
      () => validatePackReport(pack(MAX_TARBALL_BYTES + 1)),
      /Largest files: "binary" \(200 bytes unpacked\), "small.js"/
    );
  });
  for (const report of [
    null,
    [],
    [{}],
    pack(-1),
    pack(NaN),
    [{ ...pack()[0], files: [] }],
  ]) {
    it(`rejects missing or invalid npm evidence ${JSON.stringify(report)}`, () =>
      assert.throws(() => validatePackReport(report)));
  }
  it('uses npm dry-run without creating a tarball and honors package cwd', () => {
    checkNpmTarballSize({
      cwd: 'js',
      run: (command, args, options) => {
        assert.equal(command, 'npm');
        assert.deepEqual(args, ['pack', '--dry-run', '--json']);
        assert.equal(options.cwd, 'js');
        return JSON.stringify(pack());
      },
    });
  });
  for (const output of [
    'E413: 413 Payload Too Large',
    'npm error 413',
    'payload too large',
  ]) {
    it(`does not retry ${output} and gives size guidance`, async () => {
      assert.ok(isNonRetryableFailure(output));
      assert.match(
        buildPublishFailureGuidance('fixture', output),
        /tarball grew/
      );
      let calls = 0;
      const result = await publishWithRetry({
        publish: async () => {
          calls++;
          const error = new Error(output);
          error.nonRetryable = isNonRetryableFailure(output);
          return { success: false, error, output };
        },
        verify: async () => false,
        sleepFn: async () => {},
        log: () => {},
      });
      assert.equal(calls, 1);
      assert.equal(result.success, false);
    });
  }
  it('fails malformed npm output and emits a single escaped annotation', () => {
    assert.throws(() => checkNpmTarballSize({ run: () => 'not JSON' }));
    const lines = [];
    reportNpmTarballSizeError(
      new Error('oversize\n::error::forged\r100%'),
      (line) => lines.push(line)
    );
    assert.deepEqual(lines, [
      '::error title=npm tarball size gate::oversize%0A::error::forged%0D100%25',
    ]);
    assert.throws(
      () => validatePackReport([...pack(), ...pack(MAX_TARBALL_BYTES + 1)]),
      /Largest files/
    );
  });
  it('keeps authentication guidance separate', () =>
    assert.match(
      buildPublishFailureGuidance('fixture', 'E401'),
      /AUTHENTICATION/
    ));
});
