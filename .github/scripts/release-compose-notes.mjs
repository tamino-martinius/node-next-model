#!/usr/bin/env node
// Composes a release-notes markdown file by extracting the body of each
// public package's `## vNext` section in HISTORY.md and prefixing it with
// the package name as a heading. Packages with empty (or whitespace-only)
// vNext sections are skipped. If no package contributes content, the
// composed notes are an empty string — the workflow falls back to
// gh release create --generate-notes in that case.
//
// CLI: writes the composed notes to the path given as the first argument
// (defaults to ./release-notes.md if omitted). Prints the byte length to
// stderr. Exit code 1 means "no notes produced" so the workflow can branch.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VNEXT_HEADING = /^## vNext\s*$/m;
const NEXT_HEADING = /^## /m;

export function extractVNextSection(markdown) {
  const headingMatch = VNEXT_HEADING.exec(markdown);
  if (!headingMatch) return '';
  const startOfBody = headingMatch.index + headingMatch[0].length;
  const tail = markdown.slice(startOfBody);
  const nextMatch = NEXT_HEADING.exec(tail);
  const body = nextMatch === null ? tail : tail.slice(0, nextMatch.index);
  return body.trim();
}

export function composeReleaseNotes(rootDir) {
  const packagesDir = join(rootDir, 'packages');
  const sections = [];
  const entries = readdirSync(packagesDir).sort();
  for (const entry of entries) {
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
    const body = extractVNextSection(history);
    if (body === '') continue;
    sections.push(`## ${pkg.name}\n\n${body}\n`);
  }
  if (sections.length === 0) return '';
  return sections.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || './release-notes.md';
  const notes = composeReleaseNotes(process.cwd());
  writeFileSync(out, notes);
  process.stderr.write(`wrote ${notes.length} bytes to ${out}\n`);
  process.exit(notes === '' ? 1 : 0);
}
