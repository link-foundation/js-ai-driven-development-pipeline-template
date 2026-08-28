---
'@link-foundation/example-package-name': patch
---

Report why `scripts/wait-for-npm.mjs` could not confirm a release. The check
queries the npm registry over HTTP and returns `{ available, status, httpStatus,
url, error }`, so an HTTP 404 ("not published") is distinguished from an
unanswered probe (5xx, rate limit, proxy, DNS). Every attempt logs its outcome,
and an unanswered probe no longer claims the version "did not become available
on npm" — it says the publish status is unknown and points at the registry URL
to check. The step also exposes an `npm_check_status` output.
