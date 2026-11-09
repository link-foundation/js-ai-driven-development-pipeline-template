import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe } from 'test-anywhere';
import { itUnless, notLinux, sandboxed } from './helpers/skip.js';

const installer = resolve('scripts/install-lychee.sh');

// Real curl and tar, tiny fixtures, loopback only: no release download/build.
async function installFixture({
  corrupt = false,
  unavailable = false,
  version = 'v9.9.9',
  missingBinary = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'lychee-install-'));
  const requests = new Map();
  let server;
  try {
    const staging = join(root, 'staging', 'nested');
    mkdirSync(staging, { recursive: true });
    writeFileSync(
      join(staging, missingBinary ? 'README' : 'lychee'),
      '#!/usr/bin/env bash\necho "lychee 9.9.9 fixture"\n',
      { mode: 0o755 }
    );
    const archive = join(root, 'asset.tar.gz');
    execFileSync('tar', [
      '-czf',
      archive,
      '-C',
      join(root, 'staging'),
      'nested',
    ]);
    const bytes = readFileSync(archive);
    const checksum = corrupt
      ? '0'.repeat(64)
      : createHash('sha256').update(bytes).digest('hex');
    server = createServer((request, response) => {
      const count = (requests.get(request.url) || 0) + 1;
      requests.set(request.url, count);
      // Both the archive and checksum fail once, independently.
      if (unavailable || count === 1) {
        response.writeHead(503).end('try again');
      } else {
        response.end(
          request.url.endsWith('.sha256')
            ? `${checksum}  asset.tar.gz\n`
            : bytes
        );
      }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const githubPath = join(root, 'github-path');
    writeFileSync(githubPath, '');
    const destination = join(root, 'installed');
    const result = await new Promise((done, reject) => {
      const child = spawn('bash', [installer, destination], {
        env: {
          ...process.env,
          GITHUB_PATH: githubPath,
          LYCHEE_VERSION: version,
          LYCHEE_DOWNLOAD_BASE_URL: `http://127.0.0.1:${server.address().port}`,
          LYCHEE_DOWNLOAD_RETRIES: '1',
          LYCHEE_DOWNLOAD_RETRY_DELAY: '0',
        },
      });
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (status) => done({ status, stdout, stderr }));
    });
    return {
      ...result,
      requests,
      githubPath: readFileSync(githubPath, 'utf8'),
      destination,
    };
  } finally {
    if (server) {
      await new Promise((done) => server.close(done));
    }
    rmSync(root, { recursive: true, force: true });
  }
}

describe('lychee release installer', () => {
  const check = itUnless(sandboxed, notLinux);
  check(
    'recovers from a 503 on both downloads, verifies and installs a nested binary',
    async () => {
      const result = await installFixture();
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /lychee 9\.9\.9 fixture/);
      assert.deepEqual([...result.requests.values()], [2, 2]);
      assert.equal(result.githubPath, `${result.destination}\n`);
    }
  );
  for (const [name, options, message] of [
    ['checksum mismatch', { corrupt: true }, /Checksum mismatch/],
    ['exhausted retries', { unavailable: true }, /Could not download lychee/],
    ['unpinned release', { version: 'latest' }, /must be a pinned release/],
    ['missing binary', { missingBinary: true }, /No lychee binary/],
  ]) {
    check(`rejects ${name} with an installation diagnostic`, async () => {
      const result = await installFixture(options);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, message);
      assert.equal(result.githubPath, '');
      if (options.unavailable) {
        assert.deepEqual([...result.requests.values()], [2]);
      }
      if (options.version) {
        assert.equal(result.requests.size, 0);
      }
    });
  }
});
