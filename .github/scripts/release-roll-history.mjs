#!/usr/bin/env node
// For each public package, rewrites HISTORY.md so the existing `## vNext`
// heading becomes `## v<version>` and a fresh empty `## vNext` block is
// inserted directly above it. Used only for stable releases (the workflow
// guards this with the dist-tag).

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VNEXT_HEADING = /^## vNext$/m;

export function rollHistoryMarkdown(markdown, version) {
  if (!VNEXT_HEADING.test(markdown)) return markdown;
  return markdown.replace(VNEXT_HEADING, `## vNext\n\n## v${version}`);
}

export function rollHistoriesInDir(rootDir, version) {
  const packagesDir = join(rootDir, 'packages');
  const touched = [];
  for (const entry of readdirSync(packagesDir).sort()) {
    const pkgJsonPath = join(packagesDir, entry, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    } catch (_err) {
      continue;
    }
    if (pkg.private === true) continue;

    const historyPath = join(packagesDir, entry, 'HISTORY.md');
    let history;
    try {
      history = readFileSync(historyPath, 'utf8');
    } catch (_err) {
      continue;
    }
    const next = rollHistoryMarkdown(history, version);
    if (next === history) continue;
    writeFileSync(historyPath, next);
    touched.push(pkg.name);
  }
  return touched;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const version = process.argv[2];
  if (!version) {
    process.stderr.write('usage: release-roll-history.mjs <version>\n');
    process.exit(2);
  }
  const touched = rollHistoriesInDir(process.cwd(), version);
  process.stdout.write(`rolled ${touched.length} HISTORY.md file(s)\n`);
}
