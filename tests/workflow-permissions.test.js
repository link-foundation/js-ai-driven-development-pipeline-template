import { describe, it, expect } from 'test-anywhere';
import { readdirSync, readFileSync } from 'node:fs';

const WORKFLOW_DIR = '.github/workflows';

function readWorkflow(fileName) {
  return readFileSync(`${WORKFLOW_DIR}/${fileName}`, 'utf8').replaceAll(
    '\r\n',
    '\n'
  );
}

function listWorkflowFiles() {
  return readdirSync(WORKFLOW_DIR).filter((file) => /\.ya?ml$/.test(file));
}

// Returns the top-level `permissions:` block body, or undefined when the
// workflow has none (in which case jobs inherit the repository default,
// which is read/write-all on many organisations).
function getTopLevelPermissions(workflow) {
  const lines = workflow.split('\n');
  const start = lines.indexOf('permissions:');

  if (start === -1) {
    return undefined;
  }

  const end = lines.findIndex(
    (line, index) => index > start && line !== '' && !line.startsWith('  ')
  );

  return lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .filter((line) => line.trim() !== '')
    .join('\n');
}

describe('workflow token permissions', () => {
  it('declares a top-level permissions block in every workflow', () => {
    const missing = listWorkflowFiles().filter(
      (file) => getTopLevelPermissions(readWorkflow(file)) === undefined
    );

    expect(missing).toEqual([]);
  });

  it('defaults release.yml to read-only repository contents', () => {
    const permissions = getTopLevelPermissions(readWorkflow('release.yml'));

    expect(permissions).toBe('  contents: read');
  });

  it('keeps write escalation on the publishing jobs only', () => {
    const workflow = readWorkflow('release.yml');
    const jobsBody = workflow.slice(workflow.indexOf('\njobs:\n'));

    for (const job of ['release', 'instant-release', 'changeset-pr']) {
      const start = jobsBody.indexOf(`\n  ${job}:\n`);
      expect(start).not.toBe(-1);

      const rest = jobsBody.slice(start + 1);
      const end = rest.search(/\n {2}[a-zA-Z0-9_-]+:\n/);
      const block = end === -1 ? rest : rest.slice(0, end);

      expect(block.includes('      contents: write')).toBe(true);
    }
  });
});
