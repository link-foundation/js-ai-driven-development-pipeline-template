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
 * install fails, it logs the reason and passes, so offline development and
 * sandboxed runs are not blocked by an unreachable CDN.
 */

import { describe, it, expect } from 'test-anywhere';

import { loadCommandStream, USE_M_URL } from '../scripts/use-module.mjs';

async function hasNetwork() {
  try {
    const response = await fetch(USE_M_URL, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

describe('use-m loads command-stream on this Node version', () => {
  it('exposes a callable $ from command-stream', async () => {
    if (!(await hasNetwork())) {
      console.log(
        `Skipping: ${USE_M_URL} is unreachable, so use-m cannot be evaluated.`
      );
      return;
    }

    let commandStream;
    try {
      commandStream = await loadCommandStream();
    } catch (error) {
      if (
        /fetch|network|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|registry/i.test(
          error.message
        )
      ) {
        console.log(`Skipping: ${error.message}`);
        return;
      }
      throw error;
    }

    console.log(`Loaded command-stream on ${process.version}`);
    expect(typeof commandStream.$).toBe('function');
  });
});
