---
'my-package': minor
---

Add CI check to prevent manual version modification in package.json

- Added `check-version.mjs` script that detects manual version changes in PRs
- Added `check-changesets.mjs` script to check for pending changesets (converted from inline shell)
- Added `version-check` job to release.yml workflow
- Automated release PRs (changeset-release/_ and changeset-manual-release-_) are automatically skipped
