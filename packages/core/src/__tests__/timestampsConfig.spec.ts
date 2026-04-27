import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryConnector, Model, resolveSoftDelete, resolveTimestampColumns } from '../index.js';

interface Row {
  id?: number;
  name: string;
}

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} });
}

describe('resolveTimestampColumns', () => {
  it('defaults to createdAt + updatedAt when undefined or true', () => {
    expect(resolveTimestampColumns(undefined)).toEqual({
      createdAtColumn: 'createdAt',
      updatedAtColumn: 'updatedAt',
    });
    expect(resolveTimestampColumns(true)).toEqual({
      createdAtColumn: 'createdAt',
      updatedAtColumn: 'updatedAt',
    });
  });

  it('disables both when false', () => {
    expect(resolveTimestampColumns(false)).toEqual({
      createdAtColumn: undefined,
      updatedAtColumn: undefined,
    });
  });

  it('supports per-column opt-out', () => {
    expect(resolveTimestampColumns({ createdAt: true, updatedAt: false })).toEqual({
      createdAtColumn: 'createdAt',
      updatedAtColumn: undefined,
    });
  });

  it('supports custom column names', () => {
    expect(resolveTimestampColumns({ createdAt: 'inserted_at', updatedAt: 'last_change' })).toEqual(
      {
        createdAtColumn: 'inserted_at',
        updatedAtColumn: 'last_change',
      },
    );
  });
});

describe('resolveSoftDelete', () => {
  it('defaults to disabled with discardedAt column', () => {
    expect(resolveSoftDelete(undefined)).toEqual({
      softDeleteMode: false,
      softDeleteColumn: 'discardedAt',
    });
  });

  it('accepts a string shorthand for the column name', () => {
    expect(resolveSoftDelete('deleted_at')).toEqual({
      softDeleteMode: 'active',
      softDeleteColumn: 'deleted_at',
    });
  });

  it('accepts a verbose object form', () => {
    expect(resolveSoftDelete({ column: 'archived_at' })).toEqual({
      softDeleteMode: 'active',
      softDeleteColumn: 'archived_at',
    });
  });

  it('true enables with default column', () => {
    expect(resolveSoftDelete(true)).toEqual({
      softDeleteMode: 'active',
      softDeleteColumn: 'discardedAt',
    });
  });
});

describe('Model factory — custom timestamp columns', () => {
  it('writes to custom createdAt/updatedAt names', async () => {
    class Event extends Model({
      tableName: 'events',
      connector: freshConnector(),
      timestamps: { createdAt: 'inserted_at', updatedAt: 'last_change' },
      init: (props: Row) => props,
    }) {}
    const [ada] = await Event.createMany([{ name: 'hello' }]);
    const attrs = ada.attributes as Record<string, unknown>;
    expect(attrs.inserted_at).toBeInstanceOf(Date);
    expect(attrs.last_change).toBeInstanceOf(Date);
    expect(attrs.createdAt).toBeUndefined();
    expect(attrs.updatedAt).toBeUndefined();
  });

  it('omits updatedAt when disabled', async () => {
    class Event extends Model({
      tableName: 'events_no_updated',
      connector: freshConnector(),
      timestamps: { createdAt: true, updatedAt: false },
      init: (props: Row) => props,
    }) {}
    const [ada] = await Event.createMany([{ name: 'hello' }]);
    const attrs = ada.attributes as Record<string, unknown>;
    expect(attrs.createdAt).toBeInstanceOf(Date);
    expect(attrs.updatedAt).toBeUndefined();
  });

  it('touch throws when updatedAt is disabled', async () => {
    class Event extends Model({
      tableName: 'events_touch_off',
      connector: freshConnector(),
      timestamps: { updatedAt: false },
      init: (props: Row) => props,
    }) {}
    const [ada] = await Event.createMany([{ name: 'hello' }]);
    await expect(ada.touch()).rejects.toThrow(/no updatedAt column/);
  });

  it('updateAll bumps the custom updatedAt column', async () => {
    class Event extends Model({
      tableName: 'events_update_all',
      connector: freshConnector(),
      timestamps: { createdAt: 'inserted_at', updatedAt: 'last_change' },
      init: (props: Row) => props,
    }) {}
    await Event.createMany([{ name: 'a' }, { name: 'b' }]);
    await Event.updateAll({ name: 'c' });
    const rows = (await Event.all()).map((r) => r.attributes as Record<string, unknown>);
    for (const row of rows) {
      expect(row.last_change).toBeInstanceOf(Date);
    }
  });
});

describe('Model factory — custom softDelete column', () => {
  class ArchivedPost extends Model({
    tableName: 'archived_posts',
    connector: freshConnector(),
    timestamps: false,
    softDelete: 'deleted_at',
    init: (props: Row) => props,
  }) {}

  beforeEach(async () => {
    const connector = ArchivedPost.connector as MemoryConnector;
    (connector as any).storage = {};
    (connector as any).lastIds = {};
    await ArchivedPost.createMany([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  });

  it('discard writes to the custom column', async () => {
    const row = (await ArchivedPost.find(1)) as unknown as {
      discard: () => Promise<unknown>;
      attributes: Record<string, unknown>;
    };
    await row.discard();
    const attrs = row.attributes;
    expect(attrs.deleted_at).toBeInstanceOf(Date);
  });

  it('active scope filters on the custom column', async () => {
    const row = (await ArchivedPost.find(1)) as unknown as { discard: () => Promise<unknown> };
    await row.discard();
    const active = await ArchivedPost.all();
    expect(active.map((r) => (r.attributes as Row).name)).toEqual(['b', 'c']);
    const only = await ArchivedPost.onlyDiscarded().all();
    expect(only.map((r) => (r.attributes as Row).name)).toEqual(['a']);
  });

  it('restore clears the custom column', async () => {
    const row = (await ArchivedPost.find(1)) as unknown as {
      discard: () => Promise<unknown>;
      restore: () => Promise<unknown>;
      attributes: Record<string, unknown>;
    };
    await row.discard();
    await row.restore();
    expect(row.attributes.deleted_at).toBeNull();
  });
});
