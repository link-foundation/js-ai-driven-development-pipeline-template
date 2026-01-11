---
'my-package': minor
---

Add multi-language repository support for CI/CD scripts

- Add `scripts/js-paths.mjs` utility for automatic JavaScript package root detection
- Support both `./package.json` (single-language) and `./js/package.json` (multi-language repos)
- Add `--legacy-peer-deps` flag to npm install commands in release scripts to fix ERESOLVE errors
- Save and restore working directory after `cd` commands to fix `command-stream` library's `process.chdir()` behavior
- Add case study documentation with root cause analysis in `docs/case-studies/issue-21/`
