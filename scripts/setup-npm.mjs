#!/usr/bin/env node

/**
 * Update npm for OIDC trusted publishing
 * npm trusted publishing requires npm >= 11.5.1
 * Node.js 20.x ships with npm 10.x, so we need to update
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 */

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import command-stream for shell command execution
const { $ } = await use('command-stream');

// Update npm for OIDC trusted publishing (requires >= 11.5.1)
// Pin to npm@11 to avoid breaking changes from future major versions
//
// Known issue: Node.js 22.22.2 on GitHub Actions (ubuntu-24.04 image >= 20260329.72.1)
// ships with a broken npm 10.9.7 that is missing the 'promise-retry' module,
// causing `npm install -g` to fail with MODULE_NOT_FOUND.
// See: https://github.com/actions/runner-images/issues/13883
// See: https://github.com/nodejs/node/issues/62430
// See: https://github.com/npm/cli/issues/9151
//
// Workaround strategies in order of preference:
// 1. npm install -g npm@11 (standard approach)
// 2. curl tarball download (bypasses broken npm entirely)
// 3. npx npm@11 install (uses npx cache, bypasses arborist)
// 4. corepack as last resort

async function tryStandardInstall() {
  await $`npm install -g npm@11`;
}

async function tryCurlTarball() {
  const nodeDir = (
    await $`dirname $(dirname $(which node))`.run({ capture: true })
  ).stdout.trim();
  const globalNpmDir = `${nodeDir}/lib/node_modules/npm`;
  await $`curl -sL https://registry.npmjs.org/npm/-/npm-11.4.2.tgz | tar xz -C /tmp && rm -rf "${globalNpmDir}" && mv /tmp/package "${globalNpmDir}"`;
}

async function tryNpxInstall() {
  await $`npx --yes npm@11 install -g npm@11`;
}

async function tryCorepack() {
  await $`corepack enable`;
  await $`corepack prepare npm@11 --activate`;
}

async function tryStrategy(name, fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    console.warn(`Warning: ${name} failed: ${error.message}`);
    return false;
  }
}

try {
  const currentResult = await $`npm --version`.run({ capture: true });
  const currentVersion = currentResult.stdout.trim();
  console.log(`Current npm version: ${currentVersion}`);

  const strategies = [
    ['npm install -g npm@11', tryStandardInstall],
    ['curl-based tarball download', tryCurlTarball],
    ['npx-based install', tryNpxInstall],
    ['corepack', tryCorepack],
  ];

  let success = false;
  for (const [name, fn] of strategies) {
    console.log(`Trying ${name}...`);
    success = await tryStrategy(name, fn);
    if (success) {
      break;
    }
    console.warn(
      'This may be the Node.js 22.22.2 broken npm issue (actions/runner-images#13883).'
    );
  }

  if (!success) {
    const majorVersion = parseInt(currentVersion.split('.')[0], 10);
    if (majorVersion >= 11) {
      console.log(
        'Current npm version already supports OIDC trusted publishing'
      );
    } else {
      console.error(
        'ERROR: Could not update npm to >= 11.5.1 for OIDC trusted publishing.'
      );
      console.error(
        `Current npm version ${currentVersion} does not support OIDC.`
      );
      console.error(
        'See: https://github.com/actions/runner-images/issues/13883'
      );
      process.exit(1);
    }
  }

  const updatedResult = await $`npm --version`.run({ capture: true });
  const updatedVersion = updatedResult.stdout.trim();
  console.log(`Updated npm version: ${updatedVersion}`);
} catch (error) {
  console.error('Error updating npm:', error.message);
  process.exit(1);
}
