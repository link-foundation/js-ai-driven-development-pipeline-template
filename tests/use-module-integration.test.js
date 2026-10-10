/* eslint local/no-changelog-comments: "off" */

/**
 * End-to-end guard for the use-m interop shim.
 *
 * The unit tests in use-module.test.js pin the shapes we normalise; this file
 * loads `command-stream` through the real, unpinned use-m on the same Node
 * version the release jobs run (`node-version: '24.x'`) and asserts `$` is
 * callable. Without it the interop breakage only surfaces on `main`, inside a
 * job that pushes tags and publishes to npm.
 *
 * The test needs network access. When the fetch of use.js or the package
 * install fails, the tests are registered as skipped with the reason in their
 * name, so offline development and sandboxed runs are not blocked by an
 * unreachable CDN, and are not reported as a pass either.
 *
 * On Deno it is skipped: use-m imports command-stream from CDN builds there,
 * not the npm package the release jobs load on Node, and the esm.sh build of
 * command-stream@2.0.0 calls createRequire('shelljs'), which Deno rejects
 * with ERR_INVALID_ARG_VALUE.
 * Upstream: https://github.com/link-foundation/command-stream/issues/219
 *
 * On Windows it runs too, and skips only when the ESM loader rejects a bare
 * drive-letter path with ERR_UNSUPPORTED_ESM_URL_SCHEME ("On Windows,
 * absolute paths must be valid file:// URLs"). use-m converts such paths to
 * file:// URLs before importing them; the skip keeps an older or regressed
 * use-m from failing the Windows leg on a loader bug that is independent of
 * the namespace shape this shim normalises.
 */

import { describe, it, expect } from 'test-anywhere';
import { itUnless } from './helpers/skip.js';
import { networkSkipReason } from './helpers/network.js';

import { loadCommandStream, USE_M_URL } from '../scripts/use-module.mjs';

/**
 * Whether use-m hit the Windows ESM loader's bare-path rejection.
 * @param {unknown} error
 * @param {string} [platform]
 * @returns {boolean}
 */
export function isWindowsFileUrlError(error, platform = process.platform) {
  return (
    platform === 'win32' &&
    (error?.code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME' ||
      /ERR_UNSUPPORTED_ESM_URL_SCHEME/.test(error?.message ?? ''))
  );
}

/**
 * Load command-stream through the real use-m, or explain why the test
 * environment cannot (Deno, offline, Windows loader). Any other failure is
 * kept and rethrown by the tests.
 * @returns {Promise<{commandStream?: Record<string, unknown>, skip?: string, error?: unknown}>}
 */
async function loadOrSkip() {
  const skipReason = await networkSkipReason({ url: USE_M_URL });
  if (skipReason) {
    return { skip: `${skipReason}, so use-m cannot be evaluated` };
  }
  if (globalThis.Deno) {
    return {
      skip: 'use-m loads CDN builds on Deno; command-stream CDN build uses unsupported createRequire',
    };
  }

  try {
    return { commandStream: await loadCommandStream() };
  } catch (error) {
    if (isWindowsFileUrlError(error)) {
      return {
        skip:
          'use-m imported a path without a file:// scheme, which the ' +
          'Windows ESM loader rejects (ERR_UNSUPPORTED_ESM_URL_SCHEME)',
      };
    }
    if (
      /fetch|network|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|registry/i.test(
        error?.message ?? ''
      )
    ) {
      return { skip: error.message };
    }
    return { error };
  }
}

describe('isWindowsFileUrlError', () => {
  const loaderError = Object.assign(new Error("Received protocol 'c:'"), {
    code: 'ERR_UNSUPPORTED_ESM_URL_SCHEME',
  });

  it('matches the loader rejection only on Windows', () => {
    expect(isWindowsFileUrlError(loaderError, 'win32')).toBe(true);
    expect(isWindowsFileUrlError(loaderError, 'linux')).toBe(false);
  });

  it('matches the code when use-m rethrows it inside a message', () => {
    const wrapped = new Error(
      'Failed to import: ERR_UNSUPPORTED_ESM_URL_SCHEME on c:/x.js'
    );
    expect(isWindowsFileUrlError(wrapped, 'win32')).toBe(true);
    expect(isWindowsFileUrlError(new Error('boom'), 'win32')).toBe(false);
  });
});

const loaded = await loadOrSkip();

/**
 * @returns {Record<string, unknown>} command-stream exports
 */
function commandStreamOrThrow() {
  if (loaded.error) {
    throw loaded.error;
  }
  return loaded.commandStream;
}

describe('use-m loads command-stream on this Node version', () => {
  itUnless(loaded.skip)('exposes a callable $ from command-stream', () => {
    const commandStream = commandStreamOrThrow();

    console.log(`Loaded command-stream on ${process.version}`);
    expect(typeof commandStream.$).toBe('function');
  });

  itUnless(loaded.skip)('rejects when a command exits non-zero', async () => {
    const { $ } = commandStreamOrThrow();
    let rejected = false;

    try {
      await $`exit 3`;
    } catch (error) {
      rejected = true;
      expect(error.code).toBe(3);
    }

    expect(rejected).toBe(true);
  });
});
