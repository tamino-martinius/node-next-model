/**
 * Acceptance test for the no-eval refactor.
 *
 * Asserts that the shipped `dist/` output of every workspace package
 * contains no dynamic-code-evaluation call sites. Vite (and other
 * strict-CSP bundlers / Electron renderers) refuse to load bundles that
 * contain any such call.
 *
 * Run after `pnpm build`. If a future change reintroduces dynamic code
 * evaluation, this test fails with the exact file and matching line so the
 * regression is caught before publish.
 *
 * Only scans `packages/<pkg>/dist/**\/*.js`; declaration files and source
 * maps are ignored, as are demos and skills. If a dist directory does not
 * exist (the package was not built), it is skipped — the CI workflow that
 * runs this test must build first.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ok } from 'node:assert/strict';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

// Names of forbidden call sites. Kept as runtime-built strings so this file
// can be scanned by its own check without false positives.
const EVAL_NAME = 'eval' + '(';
const FN_CTOR_NAME = 'new ' + 'Function' + '(';
const FN_NAME = 'Function' + '(';

// Patterns are anchored so they don't match `myFunction(` or unrelated
// identifiers. The bare-Function pattern excludes preceding identifier
// characters so `someFunction(` and the `new Function(` form (already
// covered by the dedicated pattern) are not double-counted.
const FORBIDDEN_PATTERNS = [
  { name: EVAL_NAME, re: /\beval\s*\(/ },
  { name: FN_CTOR_NAME, re: /\bnew\s+Function\s*\(/ },
  { name: FN_NAME, re: /(?<![A-Za-z0-9_$])Function\s*\(/ },
];

function listJsFiles(dir) {
  const result = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return result;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip nested test output if any package emits them (most don't).
      if (entry.name === '__tests__' || entry.name === '__benchmark__') continue;
      result.push(...listJsFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.js')) continue;
    result.push(full);
  }
  return result;
}

function listPackages() {
  const result = [];
  let entries;
  try {
    entries = readdirSync(PACKAGES_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return result;
    throw err;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const distDir = join(PACKAGES_DIR, entry.name, 'dist');
    try {
      const s = statSync(distDir);
      if (s.isDirectory()) result.push({ name: entry.name, distDir });
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
  }
  return result;
}

function findViolations(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const violations = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const { name, re } of FORBIDDEN_PATTERNS) {
      if (re.test(line)) {
        violations.push({ line: i + 1, pattern: name, text: line.trim().slice(0, 200) });
      }
    }
  }
  return violations;
}

test('no dynamic-code evaluation in published dist bundles', () => {
  const packages = listPackages();
  ok(
    packages.length > 0,
    'no packages with dist/ found - did you run `pnpm build` before this test?',
  );

  const allViolations = [];
  for (const pkg of packages) {
    for (const file of listJsFiles(pkg.distDir)) {
      for (const v of findViolations(file)) {
        allViolations.push({
          package: pkg.name,
          file: relative(REPO_ROOT, file),
          ...v,
        });
      }
    }
  }

  if (allViolations.length > 0) {
    const lines = allViolations.map(
      (v) => `  - ${v.file}:${v.line} (${v.pattern}): ${v.text}`,
    );
    throw new Error(
      `Found ${allViolations.length} dynamic-code-evaluation call site(s) in dist:\n` +
        lines.join('\n') +
        '\n\nThe @next-model packages must be CSP-safe. Replace dynamic compilation ' +
        'with a static implementation or, if the call site is genuinely unavoidable, ' +
        'isolate it behind a runtime feature flag that consumers opt into.',
    );
  }
});
