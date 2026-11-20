import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  getConcurrentBudgetSeconds,
  getJobBudgets,
  readActions,
  readWorkflows,
} from './helpers/ci-workflow-budgets.js';
import { waitForVersionOnRegistry } from '../scripts/publish-retry.mjs';
import { parseArgs as parseWaitArgs } from '../scripts/wait-for-npm.mjs';

const releaseWorkflow = readWorkflow('.github/workflows/release.yml');
const linksWorkflow = readWorkflow('.github/workflows/links.yml');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function readWorkflow(filePath) {
  return readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
}

function normalizeNewlines(text) {
  return text.replaceAll('\r\n', '\n');
}

function listWorkflowJobs(workflow) {
  return Object.keys(parse(workflow).jobs);
}

function getTimeoutMinutes(workflow, jobName) {
  return parse(workflow).jobs[jobName]?.['timeout-minutes'];
}

function getStepBlock(workflow, stepName) {
  const lines = normalizeNewlines(workflow).split('\n');
  const start = lines.findIndex(
    (line) => line.trim() === `- name: ${stepName}`
  );

  if (start === -1) {
    return '';
  }

  const end = lines.findIndex(
    (line, index) => index > start && /^\s*- (name|uses|run):/.test(line)
  );

  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

function getStepBudgetSeconds(source, jobName) {
  const workflow = parse(source);
  return getJobBudgets(
    workflow,
    workflow.jobs[jobName],
    readActions(),
    [],
    jobName
  );
}

describe('CI timeout policy', () => {
  it('sets timeout-minutes for every release workflow job', () => {
    const expectedTimeouts = {
      'detect-changes': 5,
      'test-compilation': 5,
      'check-file-line-limits': 5,
      'version-check': 5,
      'changeset-check': 10,
      lint: 10,
      test: 15,
      'validate-docs': 5,
      release: 65,
      'instant-release': 65,
      'docker-build': 30,
      'docker-publish-config': 45,
      'docker-publish-build': 30,
      'docker-publish': 30,
      'changeset-pr': 10,
      'pipeline-status': 5,
      'release-preflight': 5,
    };

    expect(listWorkflowJobs(releaseWorkflow).sort()).toEqual(
      Object.keys(expectedTimeouts).sort()
    );

    for (const [jobName, timeout] of Object.entries(expectedTimeouts)) {
      expect(getTimeoutMinutes(releaseWorkflow, jobName)).toBe(timeout);
    }
  });

  it('sets timeout-minutes for every link workflow job', () => {
    expect(listWorkflowJobs(linksWorkflow).sort()).toEqual([
      'link-checker',
      'pipeline-status',
    ]);
    expect(getTimeoutMinutes(linksWorkflow, 'link-checker')).toBe(10);
    expect(getTimeoutMinutes(linksWorkflow, 'pipeline-status')).toBe(5);
  });

  it('parses workflow files checked out with Windows line endings', () => {
    const crlfWorkflow = [
      'name: CRLF fixture',
      '',
      'jobs:',
      '  first-job:',
      '    timeout-minutes: 5',
      '  second-job:',
      '    timeout-minutes: 10',
      '',
    ].join('\r\n');

    expect(listWorkflowJobs(crlfWorkflow)).toEqual(['first-job', 'second-job']);
    expect(getTimeoutMinutes(crlfWorkflow, 'second-job')).toBe(10);
  });

  it('caps individual Node.js and Bun tests at 30 seconds', () => {
    expect(packageJson.scripts.test).toBe(
      'node --test --test-timeout=30000 tests/*.test.js'
    );
    expect(releaseWorkflow).toContain('bun test --timeout 30000');
  });

  it('documents that the Bun flag bounds a test and not the suite', () => {
    const bunStep = getStepBlock(releaseWorkflow, 'Run tests (Bun)');

    expect(bunStep).toContain('per-test bound and does not bound the suite');
  });
});

// `timeout-minutes` on a job is a backstop, never the deadline: GitHub reports
// a job it kills as *cancelled*, not *failed*. Every long step therefore
// declares its own budget, and every budget must expire with room to spare
// before the backstop fires.
const MAX_BUDGET_SHARE_PERCENT = 70;

describe('CI execution budgets', () => {
  it('lets publish and Docker waits complete their default propagation window', async () => {
    let publishWaitSeconds = 0;
    await waitForVersionOnRegistry({
      verify: async () => false,
      sleepFn: async (ms) => {
        publishWaitSeconds += ms / 1000;
      },
      log: () => {},
    });
    const wait = parseWaitArgs([], {});
    const dockerWaitSeconds = (wait.maxAttempts - 1) * wait.sleepSeconds;
    for (const job of ['release', 'instant-release', 'docker-publish-config']) {
      const label =
        job === 'docker-publish-config'
          ? 'Docker npm availability wait'
          : 'npm publish and registry verification';
      const pollingSeconds =
        job === 'docker-publish-config'
          ? dockerWaitSeconds
          : publishWaitSeconds;
      const budget = getStepBudgetSeconds(releaseWorkflow, job).find(
        (entry) => entry.label === label
      );
      // Keep room for requests and publishing outside the sleep-only window.
      expect(budget.seconds).toBeGreaterThan(pollingSeconds + 60);
    }
  });

  it('keeps every declared step budget under its caller job backstop', () => {
    const actions = readActions();
    const unbudgeted = [];
    const violations = [];
    for (const [file, workflow] of readWorkflows()) {
      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        const location = `${file}:${jobName}`;
        const budgets = getJobBudgets(
          workflow,
          job,
          actions,
          unbudgeted,
          location
        );
        if (!budgets.length) {
          continue;
        }
        const backstop = job['timeout-minutes'];
        if (!Number.isFinite(backstop) || backstop <= 0) {
          violations.push(
            `${location} requires a positive job timeout-minutes`
          );
          continue;
        }
        const allowedSeconds = Math.floor(
          (backstop * 60 * MAX_BUDGET_SHARE_PERCENT) / 100
        );
        const invalid = budgets.filter(
          ({ seconds }) => !Number.isSafeInteger(seconds) || seconds <= 0
        );
        for (const { label, source } of invalid) {
          violations.push(
            `${location}: "${label}" has an invalid budget (${source})`
          );
        }
        const totalSeconds = getConcurrentBudgetSeconds(
          budgets.filter((budget) => !invalid.includes(budget))
        );
        if (totalSeconds > allowedSeconds) {
          violations.push(
            `${location}: budgets total ${totalSeconds}s, exceeding ${allowedSeconds}s (${MAX_BUDGET_SHARE_PERCENT}% of the ${backstop}min backstop)`
          );
        }
      }
    }

    // Check definitions even if no checked-in workflow uses them yet.
    for (const [action, manifest] of actions) {
      getJobBudgets(
        {},
        { steps: manifest.runs?.steps },
        actions,
        unbudgeted,
        action
      );
    }

    expect([...violations, ...new Set(unbudgeted)]).toEqual([]);
  });

  it('warns at the same share of the budget that the invariant allows', () => {
    const budgetScript = readWorkflow('scripts/run-with-budget-warning.sh');

    expect(budgetScript).toContain(
      `BUDGET_WARN_PERCENT:-${MAX_BUDGET_SHARE_PERCENT}`
    );
  });
});

// Fixtures for the grouping rules behind the invariant: exclusive legs,
// unconditional-plus-largest-group totals, env resolution, unreadable
// budgets.
describe('step budget grouping', () => {
  // A single matrix job runs exactly one leg, so legs guarded by distinct
  // `if:` conditions never share a job clock. Raising one leg past its
  // allowance while the others still fit must not be rejected as a sequence.
  it('sums exclusive matrix legs as alternatives, not as a sequence', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  test:',
      '    timeout-minutes: 15',
      '    strategy:',
      '      matrix:',
      '        runtime: [node, bun, deno]',
      '    steps:',
      '      - name: Run tests (Node.js)',
      "        if: matrix.runtime == 'node'",
      '        run: bash scripts/run-with-budget-warning.sh 331 "Node.js test suite" npm test',
      '      - name: Run tests (Bun)',
      "        if: matrix.runtime == 'bun'",
      '        run: bash scripts/run-with-budget-warning.sh 200 "Bun test suite" bun test',
      '      - name: Run tests (Deno)',
      "        if: matrix.runtime == 'deno'",
      '        run: bash scripts/run-with-budget-warning.sh 100 "Deno test suite" deno test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'test');

    expect(budgets.map((budget) => budget.seconds).sort()).toEqual([
      100, 200, 331,
    ]);
    expect(getConcurrentBudgetSeconds(budgets)).toBe(331);
  });

  it('still fails when a single leg exceeds the allowance', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  test:',
      '    timeout-minutes: 15',
      '    steps:',
      '      - name: Run tests (Node.js)',
      "        if: matrix.runtime == 'node'",
      '        run: bash scripts/run-with-budget-warning.sh 700 "Node.js test suite" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'test');

    expect(budgets[0].seconds).toBe(700);
    expect(budgets[0].seconds).toBeGreaterThan(630);
  });

  it('adds unconditional budgets to the largest conditional group', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  job:',
      '    timeout-minutes: 15',
      '    steps:',
      '      - name: Install',
      '        run: bash scripts/run-with-budget-warning.sh 240 "install" npm install',
      '      - name: Full leg',
      "        if: matrix.test-suite == 'full'",
      '        run: bash scripts/run-with-budget-warning.sh 1440 "full" npm test',
      '      - name: Spec leg',
      "        if: matrix.test-suite == 'specification'",
      '        run: bash scripts/run-with-budget-warning.sh 660 "spec" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'job');

    expect(getConcurrentBudgetSeconds(budgets)).toBe(1680);
  });

  it('resolves a "$VAR" budget from the step, job, or workflow env', () => {
    const workflow = [
      'name: Fixture',
      '',
      'env:',
      "  WORKFLOW_BUDGET: '50'",
      '',
      'jobs:',
      '  job:',
      '    timeout-minutes: 15',
      '    env:',
      "      JOB_BUDGET: '60'",
      '    steps:',
      '      - name: Step env wins',
      '        env:',
      "          STEP_BUDGET: '70'",
      '        run: bash scripts/run-with-budget-warning.sh "$STEP_BUDGET" "step" npm test',
      '      - name: Job env resolves',
      '        run: bash scripts/run-with-budget-warning.sh "$JOB_BUDGET" "job" npm test',
      '      - name: Workflow env resolves',
      '        run: bash scripts/run-with-budget-warning.sh "$WORKFLOW_BUDGET" "workflow" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'job');

    expect(budgets.map((budget) => budget.seconds)).toEqual([70, 60, 50]);
  });

  it('reports a budget it cannot read and never skips one silently', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  test:',
      '    timeout-minutes: 15',
      '    steps:',
      '      - name: Run tests',
      '        env:',
      "          DENO_TEST_BUDGET_SECONDS: '900'",
      '        run: bash scripts/run-with-budget-warning.sh "$DENO_TEST_BUDGET_SECONDS" "Deno test suite" deno test',
      '      - name: Unresolvable',
      '        run: bash scripts/run-with-budget-warning.sh "$NOWHERE_BUDGET" "missing var" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'test');

    expect(budgets[0].seconds).toBe(900);
    expect(Number.isFinite(budgets[1].seconds)).toBe(false);
    expect(budgets[1].source).toContain('"$NOWHERE_BUDGET"');
  });
});

describe('budget coverage across workflow and composite steps', () => {
  it('charges nested actions at each call and preserves inherited conditions', () => {
    const actions = new Map([
      [
        '.github/actions/outer',
        {
          runs: {
            steps: [{ uses: './.github/actions/inner', if: 'success()' }],
          },
        },
      ],
      [
        '.github/actions/inner',
        {
          runs: {
            steps: [
              {
                name: 'Install',
                run: 'bash "$GITHUB_WORKSPACE/scripts/run-with-budget-warning.sh" "$INSTALL_BUDGET" "Install SDK" npm ci',
              },
              { uses: 'example/action@v1', 'timeout-minutes': 1 },
            ],
          },
        },
      ],
    ]);
    const call = {
      uses: './.github/actions/outer',
      if: "matrix.runtime == 'node'",
    };
    const job = {
      steps: [
        { ...call, env: { INSTALL_BUDGET: 30 } },
        call,
        {
          if: "matrix.runtime == 'bun'",
          run: 'bash scripts/run-with-budget-warning.sh 100 "Bun tests" bun test',
        },
      ],
    };
    const findings = [];
    const budgets = getJobBudgets(
      { env: { INSTALL_BUDGET: 60 } },
      job,
      actions,
      findings,
      'fixture.yml:test'
    );
    expect(findings).toEqual([]);
    expect(budgets.map(({ seconds }) => seconds)).toEqual([
      30, 60, 60, 60, 100,
    ]);
    expect(budgets[0].conditions).toEqual([
      "matrix.runtime == 'node'",
      'success()',
    ]);
    expect(getConcurrentBudgetSeconds(budgets)).toBe(210);
  });

  it('finds an unwrapped install even beside a wrapped command', () => {
    const job = {
      steps: [
        {
          name: 'Install',
          run: 'bash "scripts/run-with-budget-warning.sh" \\\n  30 "First install" npm ci; npm ci',
        },
        {
          name: 'Offline',
          run: 'pip install --no-index sample\nnpm exec --offline -- prettier\n# npm install sample',
        },
        { name: 'Python', run: '"$RUNNER_TEMP/venv/bin/pip" install sample' },
      ],
    };
    const findings = [];
    const [wrapped] = getJobBudgets(
      {},
      job,
      new Map(),
      findings,
      'fixture.yml:test'
    );
    expect(wrapped.seconds).toBe(30);
    expect(findings).toEqual([
      'fixture.yml:test: "Install" runs npm ci',
      'fixture.yml:test: "Python" runs $RUNNER_TEMP/venv/bin/pip install sample',
    ]);
  });

  it('adds budgets with conditions that may be true at the same time', () => {
    expect(
      getConcurrentBudgetSeconds([
        { seconds: 300, conditions: ['success()'] },
        { seconds: 300, conditions: ['!cancelled()'] },
      ])
    ).toBe(600);
  });
});
