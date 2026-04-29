import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert/strict';
import { deriveDistTag } from './release-derive-dist-tag.mjs';

test('plain semver maps to latest', () => {
  strictEqual(deriveDistTag('1.0.0'), 'latest');
  strictEqual(deriveDistTag('2.4.13'), 'latest');
});

test('prerelease identifier becomes the dist-tag', () => {
  strictEqual(deriveDistTag('1.0.0-rc.0'), 'rc');
  strictEqual(deriveDistTag('1.0.0-alpha.3'), 'alpha');
  strictEqual(deriveDistTag('1.0.0-beta.12'), 'beta');
  strictEqual(deriveDistTag('1.1.0-next.0'), 'next');
});

test('dist-tag is lowercased', () => {
  strictEqual(deriveDistTag('1.0.0-RC.0'), 'rc');
});

test('rejects leading v', () => {
  throws(() => deriveDistTag('v1.0.0'), /invalid semver/i);
});

test('rejects non-semver strings', () => {
  throws(() => deriveDistTag(''), /invalid semver/i);
  throws(() => deriveDistTag('1.0'), /invalid semver/i);
  throws(() => deriveDistTag('1.0.0.0'), /invalid semver/i);
  throws(() => deriveDistTag('not-a-version'), /invalid semver/i);
});
