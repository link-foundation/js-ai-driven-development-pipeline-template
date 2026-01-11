# Changelog

## 0.4.0

### Minor Changes

- e6c2691: Add multi-language repository support for CI/CD scripts
  - Add `scripts/js-paths.mjs` utility for automatic JavaScript package root detection
  - Support both `./package.json` (single-language) and `./js/package.json` (multi-language repos)
  - Add `--legacy-peer-deps` flag to npm install commands in release scripts to fix ERESOLVE errors
  - Save and restore working directory after `cd` commands to fix `command-stream` library's `process.chdir()` behavior
  - Add case study documentation with root cause analysis in `docs/case-studies/issue-21/`

## 0.3.0

### Minor Changes

- 80d9c84: Add CI check to prevent manual version modification in package.json
  - Added `check-version.mjs` script that detects manual version changes in PRs
  - Added `check-changesets.mjs` script to check for pending changesets (converted from inline shell)
  - Added `version-check` job to release.yml workflow
  - Automated release PRs (changeset-release/_ and changeset-manual-release-_) are automatically skipped

## 0.2.2

### Patch Changes

- 9a12139: Fix CI/CD check differences between pull request and push events

  Changes:
  - Add `detect-changes` job with cross-platform `detect-code-changes.mjs` script
  - Make lint job independent of changeset-check (runs based on file changes only)
  - Allow docs-only PRs without changeset requirement
  - Handle changeset-check 'skipped' state in dependent jobs
  - Exclude `.changeset/`, `docs/`, `experiments/`, `examples/` folders and markdown files from code changes detection

## 0.2.1

### Patch Changes

- 55aef41: Make Bun the primary runtime choice throughout the template
  - Update all shebangs from `#!/usr/bin/env node` to `#!/usr/bin/env bun` in scripts, experiments, and case studies
  - Update README.md to prioritize Bun in all sections (features, development, runtime support, package managers, scripts reference)
  - Update examples to list Bun first
  - Bun now described as "Primary runtime with highest performance" and "Primary choice" for package management
  - Maintains full compatibility with Node.js and Deno

## 0.2.0

### Minor Changes

- d3f7fcd: Improve changeset CI/CD robustness for concurrent PRs
  - Update validate-changeset.mjs to only check changesets ADDED by the current PR (not pre-existing ones)
  - Add merge-changesets.mjs script to combine multiple pending changesets during release
  - Merged changesets use highest version bump type (major > minor > patch) and combine descriptions chronologically
  - Update release workflow to pass SHA environment variables and add merge step
  - Add comprehensive case study documentation for the CI/CD improvement
  - This prevents PR failures when multiple PRs merge before a release cycle completes

## 0.1.4

### Patch Changes

- e9703b9: Add ESLint complexity rules with reasonable thresholds

## 0.1.3

### Patch Changes

- 0198aaa: Add case study documentation comparing best practices from effect-template

  This changeset adds comprehensive documentation analyzing best practices from
  ProverCoderAI/effect-template repository, identifying gaps in our current setup,
  and providing prioritized recommendations for improvements.

  Key findings include missing best practices like code duplication detection (jscpd),
  ESLint complexity rules, VS Code settings, and test coverage thresholds.

## 0.1.2

### Patch Changes

- 2ea9b78: Enforce strict no-unused-vars ESLint rule without exceptions. All unused variables, arguments, and caught errors must now be removed or used. The `_` prefix no longer suppresses unused variable warnings.

## 0.1.1

### Patch Changes

- 042e877: Fix GitHub release formatting to support Major/Minor/Patch changes

  The release formatting script now correctly handles all changeset types (Major, Minor, Patch) instead of only Patch changes. This ensures that:
  - Section headers are removed from release notes
  - PR detection works for all release types
  - NPM badges are added correctly

## 0.1.0

### Minor Changes

- 65d76dc: Initial template setup with complete AI-driven development pipeline

  Features:
  - Multi-runtime support for Node.js, Bun, and Deno
  - Universal testing with test-anywhere framework
  - Automated release workflow with changesets
  - GitHub Actions CI/CD pipeline with 9 test combinations
  - Code quality tools: ESLint + Prettier with Husky pre-commit hooks
  - Package manager agnostic design

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
