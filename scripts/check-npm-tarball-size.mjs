#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getJsRoot, parseJsRootConfig } from './js-paths.mjs';

// Conservative project budget, not a guaranteed registry upload limit.
export const MAX_TARBALL_BYTES = 157 * 1024 * 1024;
const quote = (value) =>
  JSON.stringify(String(value)).replaceAll(':', '\\u003a');

export function validatePackReport(report, budget = MAX_TARBALL_BYTES) {
  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new Error('Tarball budget must be a positive integer');
  }
  if (!Array.isArray(report) || !report.length) {
    throw new Error('npm pack produced no package reports');
  }
  const failures = [];
  for (const pack of report) {
    if (
      !Number.isSafeInteger(pack.size) ||
      pack.size <= 0 ||
      !Array.isArray(pack.files) ||
      !pack.files.length ||
      pack.files.some(
        (file) =>
          typeof file.path !== 'string' ||
          !Number.isSafeInteger(file.size) ||
          file.size < 0
      )
    ) {
      throw new Error('npm pack produced malformed size or file evidence');
    }
    if (pack.size > budget) {
      const largest = [...pack.files]
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map((file) => `${quote(file.path)} (${file.size} bytes unpacked)`)
        .join(', ');
      failures.push(
        `${quote(pack.name ?? pack.filename)}: ${pack.size} compressed bytes exceeds budget ${budget}. Largest files: ${largest}. Narrow package.json files or split platform binaries into pinned optionalDependencies.`
      );
    }
  }
  if (failures.length) {
    throw new Error(failures.join('\n'));
  }
  return report;
}

export function checkNpmTarballSize({ cwd = '.', run = execFileSync } = {}) {
  const output = run('npm', ['pack', '--dry-run', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, npm_config_loglevel: 'silent' },
    shell: process.platform === 'win32',
  });
  const reports = validatePackReport(JSON.parse(output));
  for (const pack of reports) {
    console.log(
      `npm tarball ${quote(pack.name)}: ${pack.size}/${MAX_TARBALL_BYTES} compressed bytes`
    );
  }
  return reports;
}

export function reportNpmTarballSizeError(error, log = console.error) {
  const escaped = String(error.message)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
  log(`::error title=npm tarball size gate::${escaped}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    checkNpmTarballSize({
      cwd: getJsRoot({ jsRoot: parseJsRootConfig() }) || '.',
    });
  } catch (error) {
    reportNpmTarballSizeError(error);
    process.exitCode = 1;
  }
}
