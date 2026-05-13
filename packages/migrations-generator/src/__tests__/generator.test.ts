import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseArgs, runCli } from '../cli.js';
import { generateMigration, slugify, timestampFromDate, writeMigration } from '../index.js';

describe('slugify', () => {
  it('collapses non-alnum to underscores and lowercases', () => {
    expect(slugify('Create  Users!')).toBe('create_users');
    expect(slugify('add-FK on posts.user_id')).toBe('add_fk_on_posts_user_id');
  });
  it('falls back to "migration" for empty input', () => {
    expect(slugify('   ')).toBe('migration');
  });
});

describe('timestampFromDate', () => {
  it('renders UTC yyyymmddhhmmssxxx', () => {
    const d = new Date(Date.UTC(2026, 3, 24, 9, 3, 5, 7));
    expect(timestampFromDate(d)).toBe('20260424090305007');
  });
});

describe('generateMigration', () => {
  it('emits an empty stub with TODOs when no createTable is given', () => {
    const m = generateMigration({
      name: 'add FK on posts',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
    });
    expect(m.fileName).toBe('20260102030405006_add_fk_on_posts.ts');
    expect(m.contents).toContain("version: '20260102030405006'");
    expect(m.contents).toContain("name: 'add_fk_on_posts'");
    expect(m.contents).toContain('// TODO: apply schema changes');
    expect(m.contents).toContain('// TODO: revert schema changes');
  });

  it('emits a createTable body with default id + timestamps columns', () => {
    const m = generateMigration({
      name: 'create users',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      createTable: { tableName: 'users' },
    });
    expect(m.contents).toContain("await connector.createTable('users', (t) => {");
    expect(m.contents).toContain(
      "t.integer('id', { primary: true, autoIncrement: true, null: false })",
    );
    expect(m.contents).toContain("t.datetime('createdAt')");
    expect(m.contents).toContain("t.datetime('updatedAt')");
    expect(m.contents).toContain("await connector.dropTable('users')");
  });

  it('honours explicit columns + skips timestamps when requested', () => {
    const m = generateMigration({
      name: 'create events',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      createTable: {
        tableName: 'events',
        timestamps: false,
        columns: [
          { name: 'id', type: 'integer', primary: true, autoIncrement: true, nullable: false },
          { name: 'title', type: 'string', nullable: false },
          { name: 'payload', type: 'json' },
          { name: 'published', type: 'boolean', default: false },
        ],
      },
    });
    expect(m.contents).toContain("t.string('title', { null: false })");
    expect(m.contents).toContain("t.json('payload')");
    expect(m.contents).toContain("t.boolean('published', { default: false })");
    expect(m.contents).not.toContain("t.datetime('createdAt')");
  });

  it('renders parent versions + respects custom coreSpec', () => {
    const m = generateMigration({
      name: 'grant perms',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      parents: ['20250101000000000', '20250505000000000'],
      coreSpec: '@my/core-alias',
    });
    expect(m.contents).toContain("parent: ['20250101000000000', '20250505000000000'],");
    expect(m.contents).toContain("from '@my/core-alias'");
  });

  it('respects an explicit version override', () => {
    const m = generateMigration({
      name: 'anything',
      version: '001_bootstrap',
    });
    expect(m.version).toBe('001_bootstrap');
    expect(m.fileName).toBe('001_bootstrap_anything.ts');
  });

  it('unknown column kinds fall back to string', () => {
    const m = generateMigration({
      name: 'create blobs',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      createTable: {
        tableName: 'blobs',
        timestamps: false,
        columns: [{ name: 'mystery', type: 'wat' as any }],
      },
    });
    expect(m.contents).toContain("t.string('mystery')");
  });
});

describe('writeMigration', () => {
  it('creates the directory and writes the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-migrations-'));
    const result = writeMigration({
      name: 'create users',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      directory: join(dir, 'nested', 'migrations'),
      createTable: { tableName: 'users' },
    });
    expect(result.path.endsWith('20260102030405006_create_users.ts')).toBe(true);
    const disk = readFileSync(result.path, 'utf-8');
    expect(disk).toContain("await connector.createTable('users'");
  });

  it('refuses to overwrite an existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-migrations-'));
    const opts = {
      name: 'create users',
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      directory: dir,
      createTable: { tableName: 'users' as const },
    };
    writeMigration(opts);
    expect(() => writeMigration(opts)).toThrow();
  });
});

describe('parseArgs + runCli', () => {
  it('parses flags, columns, parents', () => {
    const { options } = parseArgs([
      'create users',
      '--create-table',
      'users',
      '--column',
      'id:integer:primary:autoIncrement:not-null',
      '--column',
      'name:string:not-null',
      '--parent',
      '20250101000000000',
      '--dir',
      '/tmp/out',
      '--no-timestamps',
    ]);
    expect(options.name).toBe('create users');
    expect(options.directory).toBe('/tmp/out');
    expect(options.parents).toEqual(['20250101000000000']);
    expect(options.createTable?.tableName).toBe('users');
    expect(options.createTable?.timestamps).toBe(false);
    expect(options.createTable?.columns).toEqual([
      { name: 'id', type: 'integer', primary: true, autoIncrement: true, nullable: false },
      { name: 'name', type: 'string', nullable: false },
    ]);
  });

  it('rejects unknown column flags', () => {
    expect(() => parseArgs(['x', '--column', 'foo:string:bogus'])).toThrow(/bogus/);
  });

  it('runCli writes a migration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-migrations-cli-'));
    const stdoutChunks: string[] = [];
    const result = runCli({
      args: ['create users', '--dir', dir, '--create-table', 'users'],
      now: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)),
      stdout: {
        write: (chunk: string) => {
          stdoutChunks.push(chunk);
          return true;
        },
      } as NodeJS.WritableStream,
      stderr: { write: () => true } as NodeJS.WritableStream,
    });
    expect(result.exitCode).toBe(0);
    expect(result.path?.endsWith('20260102030405006_create_users.ts')).toBe(true);
    expect(stdoutChunks.join('')).toContain('wrote');
  });

  it('runCli prints usage when given no name', () => {
    const stdoutChunks: string[] = [];
    const result = runCli({
      args: [],
      stdout: {
        write: (chunk: string) => {
          stdoutChunks.push(chunk);
          return true;
        },
      } as NodeJS.WritableStream,
    });
    expect(result.exitCode).toBe(2);
    expect(stdoutChunks.join('')).toContain('Usage:');
  });

  it('runCli surfaces unknown flags with exit 2', () => {
    const stderrChunks: string[] = [];
    const result = runCli({
      args: ['x', '--bogus'],
      stdout: { write: () => true } as NodeJS.WritableStream,
      stderr: {
        write: (c: string) => {
          stderrChunks.push(c);
          return true;
        },
      } as NodeJS.WritableStream,
    });
    expect(result.exitCode).toBe(2);
    expect(stderrChunks.join('')).toContain('Unknown flag');
  });
});
