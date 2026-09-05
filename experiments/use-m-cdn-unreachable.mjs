#!/usr/bin/env node

/**
 * Runnable reproduction of a use-m CDN outage, showing what the release
 * scripts report when the load cannot complete.
 *
 * Two shapes of outage are covered:
 *   1. Unreachable host — 203.0.113.1 is TEST-NET-3 (RFC 5737), guaranteed
 *      never routable, so it fails the way a real outage fails.
 *   2. Stalled host — a local server that accepts the connection and never
 *      answers, which undici bounds only by its 300 s `headersTimeout`.
 *
 * Usage:
 *   node experiments/use-m-cdn-unreachable.mjs
 */

import { createServer } from 'node:http';

import { loadUse } from '../scripts/use-module.mjs';

/**
 * @param {string} label
 * @param {Record<string, unknown>} options passed straight to loadUse()
 */
async function report(label, options) {
  const started = Date.now();
  try {
    await loadUse(options);
    console.log(`${label}: loaded in ${Date.now() - started}ms`);
  } catch (error) {
    console.log(`${label}: failed after ${Date.now() - started}ms`);
    console.log(`  message ${error.message}`);
    console.log(`  cause   ${error.cause?.message ?? error.cause}`);
  }
}

// 1. Unreachable CDN. The reported message names the CDN and the URL.
await report('unreachable', {
  url: 'https://203.0.113.1/use-m/use.js',
  attempts: 2,
  timeoutMs: 3000,
  retryDelayMs: 500,
});

// 2. Stalled CDN. The per-attempt deadline bounds the wait.
const server = createServer(() => {});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const stalledUrl = `http://127.0.0.1:${server.address().port}/use-m/use.js`;
await report('stalled', {
  url: stalledUrl,
  attempts: 2,
  timeoutMs: 3000,
  retryDelayMs: 500,
});
server.close();
