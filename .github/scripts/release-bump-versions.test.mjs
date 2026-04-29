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

test('updates version in v1 package-lock.json when present', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-bump-lock-'));
  try {
    mkdirSync(join(root, 'packages', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'core', 'package.json'),
      `${JSON.stringify({ name: '@next-model/core', version: '1.0.0-alpha.31' }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, 'packages', 'core', 'package-lock.json'),
      `${JSON.stringify(
        {
          name: '@next-model/core',
          version: '1.0.0-alpha.31',
          lockfileVersion: 1,
          requires: true,
          dependencies: { 'some-pkg': { version: '1.2.3' } },
        },
        null,
        2,
      )}\n`,
    );
    bumpVersionsInDir(root, '1.0.0-rc.0');
    const lock = JSON.parse(
      readFileSync(join(root, 'packages', 'core', 'package-lock.json'), 'utf8'),
    );
    strictEqual(lock.version, '1.0.0-rc.0');
    strictEqual(lock.dependencies['some-pkg'].version, '1.2.3'); // untouched
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('updates version in v3 package-lock.json (top-level + packages[""])', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-bump-lock-'));
  try {
    mkdirSync(join(root, 'packages', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'core', 'package.json'),
      `${JSON.stringify({ name: '@next-model/core', version: '1.0.0-alpha.31' }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, 'packages', 'core', 'package-lock.json'),
      `${JSON.stringify(
        {
          name: '@next-model/core',
          version: '1.0.0-alpha.31',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': { name: '@next-model/core', version: '1.0.0-alpha.31', license: 'MIT' },
            'node_modules/some-pkg': { version: '1.2.3' },
          },
        },
        null,
        2,
      )}\n`,
    );
    bumpVersionsInDir(root, '1.0.0-rc.0');
    const lock = JSON.parse(
      readFileSync(join(root, 'packages', 'core', 'package-lock.json'), 'utf8'),
    );
    strictEqual(lock.version, '1.0.0-rc.0');
    strictEqual(lock.packages[''].version, '1.0.0-rc.0');
    strictEqual(lock.packages[''].license, 'MIT'); // untouched
    strictEqual(lock.packages['node_modules/some-pkg'].version, '1.2.3'); // untouched
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('does not touch yarn.lock', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-bump-lock-'));
  try {
    mkdirSync(join(root, 'packages', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'core', 'package.json'),
      `${JSON.stringify({ name: '@next-model/core', version: '1.0.0-alpha.31' }, null, 2)}\n`,
    );
    const yarnLock = '# THIS IS AN AUTOGENERATED FILE.\n# yarn lockfile v1\n\n"foo@^1.0.0":\n  version "1.0.0"\n';
    writeFileSync(join(root, 'packages', 'core', 'yarn.lock'), yarnLock);
    bumpVersionsInDir(root, '1.0.0-rc.0');
    strictEqual(readFileSync(join(root, 'packages', 'core', 'yarn.lock'), 'utf8'), yarnLock);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('silent no-op when package-lock.json is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-bump-lock-'));
  try {
    mkdirSync(join(root, 'packages', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'core', 'package.json'),
      `${JSON.stringify({ name: '@next-model/core', version: '1.0.0-alpha.31' }, null, 2)}\n`,
    );
    // No package-lock.json. Should not throw.
    bumpVersionsInDir(root, '1.0.0-rc.0');
    const pkg = JSON.parse(
      readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8'),
    );
    strictEqual(pkg.version, '1.0.0-rc.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
