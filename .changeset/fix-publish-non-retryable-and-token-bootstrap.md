---
'@link-foundation/example-package-name': patch
---

Fix npm release path for brand-new packages (issue #77):

- `publish-to-npm.mjs` now classifies authentication / registry-configuration
  failures (404/401/403, `access token expired`, `ENEEDAUTH`, etc.) as
  non-retryable and fails fast with actionable guidance instead of retrying
  `MAX_RETRIES` times and hiding the real cause behind a generic error.
- The `release` and `instant-release` publish steps now pass an optional
  `NODE_AUTH_TOKEN` sourced from `secrets.NPM_TOKEN`, providing a first-publish
  bootstrap path. OIDC trusted publishing remains the steady-state mechanism;
  the token is only needed for the very first release of a new package.
