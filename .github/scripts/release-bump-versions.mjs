#!/usr/bin/env node
// Sets the `version` field in every public packages/*/package.json to the
// supplied value. Skips packages whose package.json sets `private: true`.
// Returns the list of package names that were updated.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveDistTag } from './release-derive-dist-tag.mjs';

export function bumpVersionsInDir(rootDir, version) {
  deriveDistTag(version); // validates semver, throws on bad input

  const packagesDir = join(rootDir, 'packages');
  const updated = [];
  for (const entry of readdirSync(packagesDir)) {
    const pkgPath = join(packagesDir, entry, 'package.json');
    let raw;
    try {
      raw = readFileSync(pkgPath, 'utf8');
    } catch (_err) {
      continue;
    }
    const pkg = JSON.parse(raw);
    if (pkg.private === true) continue;
    pkg.version = version;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    updated.push(pkg.name);
  }
  return updated;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const version = process.argv[2];
  if (!version) {
    process.stderr.write('usage: release-bump-versions.mjs <version>\n');
    process.exit(2);
  }
  const updated = bumpVersionsInDir(process.cwd(), version);
  process.stdout.write(`${updated.length} package(s) bumped to ${version}\n`);
  for (const name of updated) process.stdout.write(`  ${name}\n`);
}
