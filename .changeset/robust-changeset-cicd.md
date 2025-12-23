---
'my-package': minor
---

Improve changeset CI/CD robustness for concurrent PRs

- Update validate-changeset.mjs to only check changesets ADDED by the current PR (not pre-existing ones)
- Add merge-changesets.mjs script to combine multiple pending changesets during release
- Merged changesets use highest version bump type (major > minor > patch) and combine descriptions chronologically
- Update release workflow to pass SHA environment variables and add merge step
- Add comprehensive case study documentation for the CI/CD improvement
- This prevents PR failures when multiple PRs merge before a release cycle completes
