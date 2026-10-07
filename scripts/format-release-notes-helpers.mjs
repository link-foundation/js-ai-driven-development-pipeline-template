import { URL } from 'node:url';
import { normalizeReleaseVersion } from './release-naming.mjs';

export function normalizeReleaseVersionForBadge(releaseVersion) {
  return normalizeReleaseVersion(releaseVersion);
}

export function encodeShieldsStaticBadgeSegment(value) {
  return encodeURIComponent(value).replace(/-/g, '--').replace(/_/g, '__');
}

export function buildNpmVersionBadge(packageName, releaseVersion) {
  const versionWithoutV = normalizeReleaseVersionForBadge(releaseVersion);
  const badgeVersion = encodeShieldsStaticBadgeSegment(versionWithoutV);
  const packageVersionPath = encodeURIComponent(versionWithoutV);

  return `[![npm version](https://img.shields.io/badge/npm-${badgeVersion}-blue.svg)](https://www.npmjs.com/package/${packageName}/v/${packageVersionPath})`;
}

/** Recognize a generated npm badge image, not an arbitrary hostname mention. */
export function hasGeneratedNpmBadge(body) {
  const destinations = body.matchAll(
    /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g
  );
  for (const match of destinations) {
    try {
      const url = new URL(match[1] || match[2]);
      if (
        url.protocol === 'https:' &&
        url.hostname === 'img.shields.io' &&
        !url.username &&
        !url.password &&
        !url.port &&
        url.pathname.startsWith('/badge/npm-')
      ) {
        return true;
      }
    } catch {
      /* Invalid image destinations are ordinary unformatted notes. */
    }
  }
  return false;
}
