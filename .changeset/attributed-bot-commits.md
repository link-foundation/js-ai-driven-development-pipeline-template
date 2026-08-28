---
'@link-foundation/example-package-name': patch
---

Configure the release and merge-simulation commit author as `41898282+github-actions[bot]@users.noreply.github.com` in `scripts/version-and-commit.mjs` and `scripts/simulate-fresh-merge.sh`, so those commits are attributed to the `github-actions[bot]` account and no longer require an extra approval under rulesets with `require_extra_approval_for_unattributed_changes`.
