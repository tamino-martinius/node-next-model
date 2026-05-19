#!/usr/bin/env node
// For each public package, rewrites HISTORY.md so the existing `## vNext`
// heading becomes `## v<version>` and a fresh empty `## vNext` block is
// inserted directly above it. Used only for stable releases (the workflow
// guards this with the dist-tag).
//
// Packages whose `## vNext` section is empty (no entries since the last
// release) are skipped — they get a version bump in package.json but no
// new section in HISTORY.md.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VNEXT_HEADING_LINE = /^## vNext\s*$/m;
const NEXT_HEADING = /^## /m;

function vNextBody(markdown) {
  const headingMatch = markdown.match(VNEXT_HEADING_LINE);
  if (!headingMatch) return null;
  const startOfBody = headingMatch.index + headingMatch[0].length;
  const tail = markdown.slice(startOfBody);
  const nextMatch = tail.match(NEXT_HEADING);
  const body = nextMatch === null ? tail : tail.slice(0, nextMatch.index);
  return body.trim();
}

export function rollHistoryMarkdown(markdown, version) {
  const body = vNextBody(markdown);
  if (body === null || body === '') return markdown;
  return markdown.replace(VNEXT_HEADING_LINE, `## vNext\n\n## v${version}\n`);
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
