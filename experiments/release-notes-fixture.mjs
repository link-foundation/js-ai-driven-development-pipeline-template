// Offline dependency seam for exercising the real release formatter and gh CLI.
import { spawnSync } from 'node:child_process';
globalThis.releaseFixtureModule = (name) => {
  if (name === 'lino-arguments') {
    return {
      makeConfig: () => ({
        releaseId: '1',
        releaseVersion: 'v1.2.3',
        repository: 'owner/repo',
        commitSha: 'fallback',
        jsRoot: '.',
      }),
    };
  }
  if (name === 'command-stream') {
    return {
      $: (strings, ...values) => ({
        run: (options = {}) => {
          const command = strings.reduce(
            (text, part, index) => text + part + (values[index] ?? ''),
            ''
          );
          const result = spawnSync('bash', ['-e', '-c', command], {
            encoding: 'utf8',
            input: options.stdin,
          });
          if (result.status !== 0) {
            throw new Error(`Fixture command failed: ${result.stderr}`);
          }
          return Promise.resolve(result);
        },
      }),
      shell: { errexit: () => {} },
    };
  }
  throw new Error(`Unexpected fixture dependency: ${name}`);
};
globalThis.fetch = () =>
  Promise.resolve({
    ok: true,
    text: () =>
      Promise.resolve(
        '({use: async (name) => globalThis.releaseFixtureModule(name)})'
      ),
  });
