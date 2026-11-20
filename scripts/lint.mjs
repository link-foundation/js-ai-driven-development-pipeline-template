#!/usr/bin/env node

/**
 * Lint entry point used by `npm run lint`.
 *
 * All files are linted for errors. Warnings are reported only in files that
 * the current branch changes relative to its base, keeping each run focused on
 * actionable findings. Every reported error or warning fails the run. Set
 * LINT_ALL_WARNINGS=1 to report every warning, as pushes to main do.
 */

import { execFileSync } from 'node:child_process';
import { ESLint } from 'eslint';
import {
  changesLintConfig,
  filterWarningsToChangedFiles,
  lintExitCode,
} from './lint-changed-files.mjs';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function resolveBaseRef() {
  const baseRef = process.env.LINT_BASE_REF || process.env.GITHUB_BASE_REF;
  const candidates = baseRef
    ? [baseRef, `origin/${baseRef}`]
    : ['origin/main', 'main', 'origin/master', 'master'];

  for (const candidate of candidates) {
    try {
      git(['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`]);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function collectChangedFiles() {
  const base = resolveBaseRef();
  if (!base) {
    return null;
  }

  try {
    const mergeBase = git(['merge-base', 'HEAD', base]).trim();
    // Include both sides of renames so moving or deleting a local lint rule
    // still triggers a repository-wide check.
    const diff = ['diff', '--name-only', '--no-renames', '-z'];
    const changed = new Set(
      [
        git([...diff, mergeBase, 'HEAD', '--']),
        git([...diff, 'HEAD', '--']),
        git(['ls-files', '--others', '--exclude-standard', '-z']),
      ].flatMap((paths) => paths.split('\0').filter(Boolean))
    );
    if (process.env.LINT_VERBOSE === '1') {
      console.log(
        `ESLint base ${base} (${mergeBase}): ${JSON.stringify([...changed])}`
      );
    }
    return { base, changed };
  } catch (error) {
    if (process.env.LINT_VERBOSE === '1') {
      console.error(error.message);
    }
    return null;
  }
}

function warningScope() {
  if (process.env.LINT_ALL_WARNINGS === '1') {
    return null;
  }

  const scope = collectChangedFiles();
  if (!scope || changesLintConfig(scope.changed)) {
    return null;
  }

  console.log(
    `Reporting warnings in ${scope.changed.size} file(s) changed since ${scope.base}.`
  );
  return scope.changed;
}

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(['.']);
  const changedFiles = warningScope();
  if (!changedFiles) {
    console.log('Reporting warnings in all files.');
  }

  const reported = changedFiles
    ? filterWarningsToChangedFiles(results, changedFiles, process.cwd())
    : results;

  const formatter = await eslint.loadFormatter('stylish');
  const output = await formatter.format(reported);

  if (output) {
    console.log(output);
  }

  const hiddenWarnings =
    results.reduce((total, result) => total + result.warningCount, 0) -
    reported.reduce((total, result) => total + result.warningCount, 0);

  if (hiddenWarnings > 0) {
    console.log(
      `${hiddenWarnings} warning(s) in unchanged files were not reported. Run LINT_ALL_WARNINGS=1 npm run lint to see them.`
    );
  }

  process.exit(lintExitCode(reported));
}

await main();
