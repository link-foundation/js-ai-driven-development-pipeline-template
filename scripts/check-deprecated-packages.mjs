#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function lockedVersions(lock) {
  if (
    !lock.packages ||
    typeof lock.packages !== 'object' ||
    Array.isArray(lock.packages)
  ) {
    throw new Error('Expected a package-lock.json with a packages map.');
  }

  const versions = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    const match = path.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
    if (!match || entry.link) {
      continue;
    }

    const name = entry.name ?? match[1];
    const { version } = entry;
    if (
      typeof name !== 'string' ||
      !name ||
      typeof version !== 'string' ||
      !version
    ) {
      throw new Error(`Missing registry package identity for ${path}.`);
    }
    versions.set(`${name}@${version}`, { name, version });
  }
  return [...versions];
}

async function deprecation({ name, version }, fetchManifest) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await fetchManifest(url, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`registry returned HTTP ${response.status}`);
  }

  const manifest = await response.json();
  if (manifest?.name !== name || manifest.version !== version) {
    throw new Error('registry returned an unexpected package or version');
  }
  if (
    manifest.deprecated !== undefined &&
    typeof manifest.deprecated !== 'string'
  ) {
    throw new Error('registry returned an invalid deprecated field');
  }
  return manifest.deprecated;
}

export async function checkDeprecatedPackages(lock, fetchManifest = fetch) {
  const packages = lockedVersions(lock);
  const deprecated = [];
  const errors = [];
  let next = 0;

  async function worker() {
    for (;;) {
      const entry = packages[next++];
      if (!entry) {
        return;
      }

      const [id, identity] = entry;
      try {
        const message = await deprecation(identity, fetchManifest);
        if (message) {
          deprecated.push(`${id}: ${message}`);
        }
      } catch (error) {
        errors.push(`${id}: ${error.message}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(8, packages.length) }, worker)
  );
  return {
    checked: packages.length,
    deprecated: deprecated.sort(),
    errors: errors.sort(),
  };
}

function escapeAnnotation(message) {
  return message
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

async function main(lockfile, failOnDeprecation) {
  const lock = JSON.parse(await readFile(lockfile, 'utf8'));
  const { checked, deprecated, errors } = await checkDeprecatedPackages(lock);
  const level = failOnDeprecation ? 'error' : 'warning';

  for (const finding of deprecated) {
    console.log(
      `::${level} title=Deprecated npm package::${escapeAnnotation(finding)}`
    );
  }
  for (const error of errors) {
    console.error(
      `::error title=npm registry lookup failed::${escapeAnnotation(error)}`
    );
  }

  console.log(
    `Registry check for ${lockfile}: ${checked} locked versions, ${deprecated.length} deprecated, ${errors.length} lookup errors.`
  );
  return errors.length || (failOnDeprecation && deprecated.length) ? 1 : 0;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    process.exitCode = await main(
      process.argv[2] ?? 'package-lock.json',
      process.env.DEPRECATED_FAIL === 'true'
    );
  } catch (error) {
    console.error(
      `::error title=Live npm deprecation check failed::${escapeAnnotation(error.message)}`
    );
    process.exitCode = 1;
  }
}
