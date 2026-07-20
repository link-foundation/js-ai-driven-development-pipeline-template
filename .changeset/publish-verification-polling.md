---
'@link-foundation/example-package-name': patch
---

Split publish and verification failure domains in `publish-to-npm.mjs`: verification now polls the npm registry with exponential backoff, and a verification miss no longer re-runs `changeset publish`.
