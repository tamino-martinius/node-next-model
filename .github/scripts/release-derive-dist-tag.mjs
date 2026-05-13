#!/usr/bin/env node
// Maps a semver string to an npm dist-tag.
// Rules:
//   - The input must be plain semver (no leading "v"). Build metadata is rejected.
//   - If the version has no prerelease component, the dist-tag is "latest".
//   - Otherwise the dist-tag is the first dot-separated identifier of the
//     prerelease component, lowercased. (e.g. 1.0.0-rc.0 -> "rc".)
// CLI: prints the dist-tag to stdout. Used from release.yml to drive
//   `npm publish --tag <distTag>` and the GitHub release prerelease flag.

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function deriveDistTag(version) {
  const match = SEMVER_RE.exec(version);
  if (!match) {
    throw new Error(`invalid semver: ${JSON.stringify(version)}`);
  }
  const prerelease = match[4];
  if (!prerelease) return 'latest';
  const firstId = prerelease.split('.')[0];
  return firstId.toLowerCase();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const version = process.argv[2];
  if (!version) {
    process.stderr.write('usage: release-derive-dist-tag.mjs <version>\n');
    process.exit(2);
  }
  process.stdout.write(`${deriveDistTag(version)}\n`);
}
