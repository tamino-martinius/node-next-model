import { test } from 'node:test';
import { strictEqual } from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollHistoryMarkdown, rollHistoriesInDir } from './release-roll-history.mjs';

test('rollHistoryMarkdown renames vNext heading and prepends a new empty vNext block', () => {
  const before = ['# History', '', '## vNext', '', '- Big change', '', '## v0.4.0', '', '- Older', ''].join('\n');
  const after = rollHistoryMarkdown(before, '1.0.0');
  strictEqual(
    after,
    [
      '# History',
      '',
      '## vNext',
      '',
      '## v1.0.0',
      '',
      '- Big change',
      '',
      '## v0.4.0',
      '',
      '- Older',
      '',
    ].join('\n'),
  );
});

test('rollHistoryMarkdown is a no-op when there is no vNext heading', () => {
  const before = '# History\n\n## v0.4.0\n\n- Older\n';
  strictEqual(rollHistoryMarkdown(before, '1.0.0'), before);
});

test('rollHistoryMarkdown handles vNext as the last section', () => {
  const before = '# History\n\n## vNext\n\n- Only\n';
  const after = rollHistoryMarkdown(before, '1.0.0');
  strictEqual(after, '# History\n\n## vNext\n\n## v1.0.0\n\n- Only\n');
});

test('rollHistoryMarkdown matches vNext heading with trailing whitespace', () => {
  const before = '# History\n\n## vNext   \n\n- Entry\n';
  const after = rollHistoryMarkdown(before, '1.0.0');
  strictEqual(after, '# History\n\n## vNext\n\n## v1.0.0\n\n- Entry\n');
});

test('rollHistoriesInDir applies the roll to every public package', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-roll-'));
  try {
    mkdirSync(join(root, 'packages', 'core'), { recursive: true });
    mkdirSync(join(root, 'packages', 'zod'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'core', 'package.json'),
      `${JSON.stringify({ name: '@next-model/core', version: '1.0.0' }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, 'packages', 'zod', 'package.json'),
      `${JSON.stringify({ name: '@next-model/zod', version: '1.0.0' }, null, 2)}\n`,
    );
    writeFileSync(
      join(root, 'packages', 'core', 'HISTORY.md'),
      '# History\n\n## vNext\n\n- core change\n\n## v0.4.0\n\n- old\n',
    );
    writeFileSync(
      join(root, 'packages', 'zod', 'HISTORY.md'),
      '# History\n\n## vNext\n\n## v0.0.1\n\n- old\n',
    );

    const touched = rollHistoriesInDir(root, '1.0.0');
    strictEqual(touched.length, 2);

    const core = readFileSync(join(root, 'packages', 'core', 'HISTORY.md'), 'utf8');
    const zod = readFileSync(join(root, 'packages', 'zod', 'HISTORY.md'), 'utf8');
    strictEqual(core.includes('## vNext\n\n## v1.0.0\n\n- core change'), true);
    strictEqual(zod.includes('## vNext\n\n## v1.0.0\n\n## v0.0.1'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rollHistoriesInDir skips private packages', () => {
  const root = mkdtempSync(join(tmpdir(), 'next-model-roll-'));
  try {
    mkdirSync(join(root, 'packages', 'demo'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'demo', 'package.json'),
      `${JSON.stringify({ name: '@next-model/demo', version: '1.0.0', private: true }, null, 2)}\n`,
    );
    const original = '# History\n\n## vNext\n\n- private\n';
    writeFileSync(join(root, 'packages', 'demo', 'HISTORY.md'), original);
    const touched = rollHistoriesInDir(root, '1.0.0');
    strictEqual(touched.length, 0);
    strictEqual(readFileSync(join(root, 'packages', 'demo', 'HISTORY.md'), 'utf8'), original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
