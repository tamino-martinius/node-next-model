import { test } from 'node:test';
import { strictEqual } from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractVNextSection,
  composeReleaseNotes,
} from './release-compose-notes.mjs';

test('extractVNextSection returns content between vNext heading and next h2', () => {
  const md = [
    '# History',
    '',
    '## vNext',
    '',
    '- Added foo',
    '- Removed bar',
    '',
    '## v0.4.0',
    '',
    '- Older entry',
    '',
  ].join('\n');
  strictEqual(extractVNextSection(md), '- Added foo\n- Removed bar');
});

test('extractVNextSection returns empty string when section is empty', () => {
  const md = ['# History', '', '## vNext', '', '## v0.4.0', '', '- Older'].join('\n');
  strictEqual(extractVNextSection(md), '');
});

test('extractVNextSection returns empty string when section only contains whitespace', () => {
  const md = ['# History', '', '## vNext', '   ', '\t', '## v0.4.0'].join('\n');
  strictEqual(extractVNextSection(md), '');
});

test('extractVNextSection handles vNext as last section', () => {
  const md = ['# History', '', '## vNext', '', '- Only entry', ''].join('\n');
  strictEqual(extractVNextSection(md), '- Only entry');
});

test('extractVNextSection returns empty string when vNext heading is missing', () => {
  const md = ['# History', '', '## v0.4.0', '', '- Older'].join('\n');
  strictEqual(extractVNextSection(md), '');
});

function makePackagesDir(entries) {
  const root = mkdtempSync(join(tmpdir(), 'next-model-notes-'));
  const packagesDir = join(root, 'packages');
  mkdirSync(packagesDir, { recursive: true });
  for (const [name, body] of Object.entries(entries)) {
    const dir = join(packagesDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify({ name: `@next-model/${name}`, version: '1.0.0-rc.0' }, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, 'HISTORY.md'),
      `# History\n\n## vNext\n\n${body}\n\n## v0.0.1\n\n- seed\n`,
    );
  }
  return root;
}

test('composeReleaseNotes produces one section per package with non-empty vNext', () => {
  const root = makePackagesDir({
    core: '- Big change',
    zod: '- Zod change',
    typebox: '',
  });
  try {
    const notes = composeReleaseNotes(root);
    strictEqual(
      notes,
      [
        '## @next-model/core',
        '',
        '- Big change',
        '',
        '## @next-model/zod',
        '',
        '- Zod change',
        '',
      ].join('\n'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('composeReleaseNotes returns empty string when no package has vNext content', () => {
  const root = makePackagesDir({ core: '', zod: '' });
  try {
    strictEqual(composeReleaseNotes(root), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('composeReleaseNotes orders packages alphabetically by directory', () => {
  const root = makePackagesDir({
    zod: '- z',
    core: '- c',
    arktype: '- a',
  });
  try {
    const notes = composeReleaseNotes(root);
    const headings = notes
      .split('\n')
      .filter((line) => line.startsWith('## '));
    strictEqual(headings.join('|'), '## @next-model/arktype|## @next-model/core|## @next-model/zod');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('composeReleaseNotes skips private packages', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-notes-'));
  const pkgDir = join(root, 'packages', 'demo');
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, 'package.json'),
    `${JSON.stringify(
      { name: '@next-model/demo', version: '1.0.0-rc.0', private: true },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(pkgDir, 'HISTORY.md'),
    '# History\n\n## vNext\n\n- private change\n\n## v0.0.1\n',
  );
  try {
    strictEqual(composeReleaseNotes(root), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
