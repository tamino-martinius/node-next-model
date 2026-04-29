import { test } from 'node:test';
import { strictEqual, deepStrictEqual, throws } from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bumpVersionsInDir } from './release-bump-versions.mjs';

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'next-model-bump-'));
  mkdirSync(join(root, 'packages', 'core'), { recursive: true });
  mkdirSync(join(root, 'packages', 'zod'), { recursive: true });
  mkdirSync(join(root, 'packages', 'private-tool'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'core', 'package.json'),
    `${JSON.stringify({ name: '@next-model/core', version: '1.0.0-alpha.31' }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, 'packages', 'zod', 'package.json'),
    `${JSON.stringify({ name: '@next-model/zod', version: '1.0.0-alpha.0' }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, 'packages', 'private-tool', 'package.json'),
    `${JSON.stringify(
      { name: '@next-model/private-tool', version: '0.0.0', private: true },
      null,
      2,
    )}\n`,
  );
  return root;
}

test('updates every public package version', () => {
  const root = makeWorkspace();
  try {
    const updated = bumpVersionsInDir(root, '1.0.0-rc.0');
    deepStrictEqual(updated.sort(), ['@next-model/core', '@next-model/zod']);
    const core = JSON.parse(readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8'));
    const zod = JSON.parse(readFileSync(join(root, 'packages', 'zod', 'package.json'), 'utf8'));
    strictEqual(core.version, '1.0.0-rc.0');
    strictEqual(zod.version, '1.0.0-rc.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('skips private packages', () => {
  const root = makeWorkspace();
  try {
    bumpVersionsInDir(root, '1.0.0-rc.0');
    const priv = JSON.parse(
      readFileSync(join(root, 'packages', 'private-tool', 'package.json'), 'utf8'),
    );
    strictEqual(priv.version, '0.0.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('preserves trailing newline', () => {
  const root = makeWorkspace();
  try {
    bumpVersionsInDir(root, '1.0.0-rc.0');
    const raw = readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8');
    strictEqual(raw.endsWith('\n'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects invalid semver up front', () => {
  const root = makeWorkspace();
  try {
    throws(() => bumpVersionsInDir(root, 'v1.0.0'), /invalid semver/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
