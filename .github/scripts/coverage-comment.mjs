#!/usr/bin/env node
// Reads every coverage-summary.json under coverage-artifacts/ (recursively) and
// renders a markdown table for marocchino/sticky-pull-request-comment. Output is
// written to $GITHUB_OUTPUT as `message=<heredoc>`.

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'coverage-artifacts';
const FIELDS = ['statements', 'branches', 'functions', 'lines'];

function pct(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `${n.toFixed(2)}%`;
}

function inferPackageName(filePath) {
  const parts = filePath.split('/');
  // Prefer `packages/<name>/...` since that's the canonical workspace layout.
  const pkgIdx = parts.indexOf('packages');
  if (pkgIdx !== -1 && parts[pkgIdx + 1]) return parts[pkgIdx + 1];
  // Fallback: artifact directory name (strip a leading `coverage-`).
  const artifactDir = parts[1] ?? 'unknown';
  return artifactDir.replace(/^coverage-/, '');
}

async function walk(dir, files) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else if (entry.name === 'coverage-summary.json') {
      files.push(full);
    }
  }
}

async function discoverArtifacts() {
  if (!existsSync(ROOT)) return [];
  const paths = [];
  await walk(ROOT, paths);
  const out = [];
  const seen = new Set();
  for (const path of paths) {
    let summary;
    try {
      summary = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      continue;
    }
    const name = inferPackageName(path);
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, total: summary.total ?? {} });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const artifacts = await discoverArtifacts();
  const lines = [];
  lines.push('### Coverage report');
  lines.push('');
  if (artifacts.length === 0) {
    lines.push('_No coverage artifacts found._');
  } else {
    lines.push('| Package | Statements | Branches | Functions | Lines |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const { name, total } of artifacts) {
      const cells = FIELDS.map((field) => pct(total[field]?.pct));
      lines.push(`| \`${name}\` | ${cells.join(' | ')} |`);
    }
    lines.push('');
    lines.push('_Posted by `.github/scripts/coverage-comment.mjs`._');
  }
  const message = lines.join('\n');
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    const delimiter = `EOF_${Date.now().toString(36)}`;
    await writeFile(output, `message<<${delimiter}\n${message}\n${delimiter}\n`, { flag: 'a' });
  } else {
    console.log(message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
