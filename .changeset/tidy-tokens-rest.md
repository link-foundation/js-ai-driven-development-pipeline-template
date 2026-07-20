---
'@link-foundation/example-package-name': patch
---

Add a least-privilege top-level `permissions: contents: read` block to `release.yml` and `links.yml` so jobs no longer inherit the repository default `GITHUB_TOKEN` scope, with write access escalated only on the publishing jobs.
