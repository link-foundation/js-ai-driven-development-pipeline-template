---
'my-package': minor
---

Add `--tag-prefix` option to release scripts for multi-language repos

The `create-github-release.mjs` and `format-github-release.mjs` scripts now accept a `--tag-prefix` CLI parameter (defaulting to `v`) that allows users to customize the git tag prefix. This enables use in multi-language repositories where different language packages need distinct tag prefixes (e.g., `js-v1.0.0` vs `rust-v1.0.0`).
