---
'@link-foundation/example-package-name': patch
---

Bound the use-m CDN fetch with a per-attempt deadline and a retry, and report a load failure from the script that needs it.

`loadUse()` fetched `https://unpkg.com/use-m/use.js` with a bare `fetch()`, so a CDN blip surfaced as `TypeError: fetch failed` — a message naming neither the CDN nor the URL — and a connection that was accepted but never answered was bounded only by undici's 300 s `headersTimeout`. Each attempt now carries a 15 s deadline enforced by an `AbortController`, a failed attempt is retried up to three times with exponential backoff (51 s worst case), and the final error names the URL, the attempt count and the underlying reason, keeping the original failure as its `cause`.

The seven release scripts that loaded these modules at module scope now go through `scripts/bootstrap-dependencies.mjs`, which prints a GitHub `::error::` annotation and writes the fallback outputs the workflow reads — `published=false` for `publish-to-npm.mjs`, `version_committed=false` for `version-and-commit.mjs` — so a CDN outage no longer leaves a job with an empty `GITHUB_OUTPUT` and a loader stack.
