#!/usr/bin/env node

/**
 * Lightweight debug logger for the pipeline scripts.
 *
 * When a dependency fails to load, a bare `$ is not a function` says nothing
 * about the module shape that produced it. This helper lets the scripts keep
 * such tracing in the code with the default state switched off, so an interop
 * regression stays readable from the CI log alone.
 *
 * Activation:
 *   - CI_SCRIPTS_DEBUG=1 (preferred local toggle), or
 *   - RUNNER_DEBUG=1 (GitHub "Re-run all jobs with debug logging"), or
 *   - ACTIONS_STEP_DEBUG=true (the secret-gated workflow debug switch).
 *
 * Every line is prefixed with `::debug::` so GitHub Actions renders it in the
 * collapsible debug stream, keeping the main log clean.
 *
 * Usage:
 *   import { debug } from './debug-print.mjs';
 *   debug('loaded command-stream', { keys });
 */

/**
 * @returns {boolean} true when debug output is enabled for this process
 */
export function isDebugEnabled(env = process.env) {
  return (
    env.CI_SCRIPTS_DEBUG === '1' ||
    env.CI_SCRIPTS_DEBUG === 'true' ||
    env.RUNNER_DEBUG === '1' ||
    env.ACTIONS_STEP_DEBUG === 'true'
  );
}

function format(value) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Print a debug line, but only when debug output is enabled.
 * @param {...unknown} parts values to join into one message
 */
export function debug(...parts) {
  if (!isDebugEnabled()) {
    return;
  }
  const line = parts.map(format).join(' ');
  for (const chunk of line.split('\n')) {
    console.log(`::debug::${chunk}`);
  }
}
