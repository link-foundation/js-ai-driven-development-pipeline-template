import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkDeprecatedPackages } from '../scripts/check-deprecated-packages.mjs';
import { describe, expect, it } from 'test-anywhere';

/**
 * Every committed lockfile must install without deprecated packages. There
 * is deliberately no allowlist: replace or override a deprecated dependency
 * (see docs/CONTRIBUTING.md).
 * npm records `deprecated` when it writes a lockfile, so a package that is
 * deprecated later shows up after the next lockfile update. The Security
 * workflow also queries the live registry to cover the intervening period.
 */
const LOCKFILES = [
  'package-lock.json',
  '.github/actions/artifact-transport/package-lock.json',
  'examples/universal-app/package-lock.json',
];

function deprecatedPackages(lockfile) {
  const { packages } = JSON.parse(readFileSync(lockfile, 'utf8'));
  return Object.entries(packages)
    .filter(([, info]) => info.deprecated)
    .map(
      ([path, info]) =>
        `${path.replace(/^node_modules\//, '')}@${info.version}: ${info.deprecated}`
    )
    .sort();
}

describe('deprecated packages', () => {
  for (const lockfile of LOCKFILES) {
    it(`${lockfile} has no deprecated packages`, () => {
      expect(deprecatedPackages(lockfile)).toEqual([]);
    });
  }

  it('covers every committed npm lockfile', () => {
    const tracked = execFileSync(
      'git',
      ['ls-files', '--', '*package-lock.json'],
      {
        encoding: 'utf8',
      }
    )
      .split('\n')
      .filter(Boolean);
    expect(tracked.sort()).toEqual([...LOCKFILES].sort());
  });
});

describe('live npm deprecation metadata', () => {
  const manifest = (name, version, extra = {}) => ({
    ok: true,
    json: async () => ({ name, version, ...extra }),
  });

  it('deduplicates copies, resolves npm aliases and finds deprecations absent from the lock', async () => {
    const lock = {
      packages: {
        '': { name: 'project', version: '1.0.0' },
        'node_modules/alias': { name: '@scope/pkg', version: '1.2.3' },
        'node_modules/parent/node_modules/@scope/pkg': { version: '1.2.3' },
        'node_modules/workspace': {
          link: true,
          resolved: 'packages/workspace',
        },
      },
    };
    const requests = [];
    const result = await checkDeprecatedPackages(
      lock,
      async (url, { signal }) => {
        requests.push(url);
        expect(signal.aborted).toBe(false);
        return manifest('@scope/pkg', '1.2.3', {
          deprecated: 'Use @scope/replacement',
        });
      }
    );
    expect(requests).toEqual([
      'https://registry.npmjs.org/%40scope%2Fpkg/1.2.3',
    ]);
    expect(result).toEqual({
      checked: 1,
      deprecated: ['@scope/pkg@1.2.3: Use @scope/replacement'],
      errors: [],
    });
  });

  it('fails closed on HTTP, network, JSON and version mismatch errors', async () => {
    const lock = {
      packages: Object.fromEntries(
        ['http', 'network', 'json', 'version'].map((name) => [
          `node_modules/${name}`,
          { version: '1.2.3' },
        ])
      ),
    };
    const outcomes = {
      http: () => ({ ok: false, status: 503 }),
      json: () => ({ ok: true, json: async () => JSON.parse('bad JSON') }),
      network: () => {
        throw new Error('connection refused');
      },
      version: () => manifest('version', '9.9.9'),
    };
    const result = await checkDeprecatedPackages(lock, async (url) =>
      outcomes[url.split('/').at(-2)]()
    );
    expect(result.deprecated).toEqual([]);
    expect(result.errors.length).toBe(4);
    expect(result.errors).toContain('http@1.2.3: registry returned HTTP 503');
    expect(result.errors).toContain('network@1.2.3: connection refused');
    expect(result.errors).toContain(
      'version@1.2.3: registry returned an unexpected package or version'
    );
  });

  it('warns on a PR, fails on schedule and always fails a registry outage', () => {
    const directory = mkdtempSync(join(tmpdir(), 'npm-deprecation-'));
    const lock = join(directory, 'package-lock.json');
    const script = resolve('scripts/check-deprecated-packages.mjs');
    const preload =
      'globalThis.fetch = async () => process.env.MOCK_REGISTRY_ERROR ? { ok: false, status: 503 } : new Response(JSON.stringify({ name: "sample", version: "1.0.0", deprecated: "use replacement" }));';
    const run = (fail, outage = '') =>
      spawnSync(
        'node',
        [
          '--import',
          `data:text/javascript,${encodeURIComponent(preload)}`,
          script,
          lock,
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            DEPRECATED_FAIL: fail,
            MOCK_REGISTRY_ERROR: outage,
          },
        }
      );
    try {
      writeFileSync(
        lock,
        JSON.stringify({
          packages: { 'node_modules/sample': { version: '1.0.0' } },
        })
      );
      const pr = run('false');
      expect(pr.status).toBe(0);
      expect(pr.stdout).toContain(
        '::warning title=Deprecated npm package::sample@1.0.0'
      );
      const scheduled = run('true');
      expect(scheduled.status).toBe(1);
      expect(scheduled.stdout).toContain(
        '::error title=Deprecated npm package::sample@1.0.0'
      );
      const outage = run('false', '1');
      expect(outage.status).toBe(1);
      expect(outage.stderr).toContain(
        '::error title=npm registry lookup failed'
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
