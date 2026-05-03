import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';

const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');
const linksWorkflow = readFileSync('.github/workflows/links.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function listWorkflowJobs(workflow) {
  const jobsStart = workflow.indexOf('\njobs:\n');
  const jobsBody = jobsStart === -1 ? '' : workflow.slice(jobsStart);
  const matches = jobsBody.matchAll(/^[ ]{2}([a-zA-Z0-9_-]+):\s*$/gm);

  return Array.from(matches, (match) => match[1]);
}

function getJobBlock(workflow, jobName) {
  const lines = workflow.split('\n');
  const jobHeader = `  ${jobName}:`;
  const start = lines.findIndex((line) => line === jobHeader);

  if (start === -1) {
    return '';
  }

  const end = lines.findIndex(
    (line, index) => index > start && /^[ ]{2}[a-zA-Z0-9_-]+:\s*$/.test(line)
  );

  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

function getTimeoutMinutes(workflow, jobName) {
  const block = getJobBlock(workflow, jobName);
  const timeout = block.match(/^[ ]{4}timeout-minutes:\s*(\d+)\s*$/m);

  return timeout ? Number(timeout[1]) : undefined;
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
      test: 10,
      'validate-docs': 5,
      release: 30,
      'instant-release': 30,
      'changeset-pr': 10,
    };

    expect(listWorkflowJobs(releaseWorkflow).sort()).toEqual(
      Object.keys(expectedTimeouts).sort()
    );

    for (const [jobName, timeout] of Object.entries(expectedTimeouts)) {
      expect(getTimeoutMinutes(releaseWorkflow, jobName)).toBe(timeout);
    }
  });

  it('sets timeout-minutes for every link workflow job', () => {
    expect(listWorkflowJobs(linksWorkflow)).toEqual(['link-checker']);
    expect(getTimeoutMinutes(linksWorkflow, 'link-checker')).toBe(10);
  });

  it('caps individual Node.js and Bun tests at 30 seconds', () => {
    expect(packageJson.scripts.test).toBe(
      'node --test --test-timeout=30000 tests/*.test.js'
    );
    expect(releaseWorkflow).toContain('run: bun test --timeout 30000');
  });
});
