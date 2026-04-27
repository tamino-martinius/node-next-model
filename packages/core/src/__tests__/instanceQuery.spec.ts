import { describe, expect, it } from 'vitest';
import { InstanceQuery } from '../query/InstanceQuery.js';
import { NotFoundError } from '../errors.js';

const FakeModel = { tableName: 'users', keys: { id: 1 } };

describe('InstanceQuery', () => {
  it('resolves to undefined when execute returns undefined', async () => {
    const q = new InstanceQuery(FakeModel as any, 'first', async () => undefined);
    expect(await q).toBeUndefined();
  });

  it('resolves to the record when execute returns one', async () => {
    const q = new InstanceQuery(FakeModel as any, 'first', async () => ({ id: 1 }));
    expect(await q).toEqual({ id: 1 });
  });

  it('findOrFail terminal throws NotFoundError on undefined', async () => {
    const q = new InstanceQuery(FakeModel as any, 'findOrFail', async () => undefined);
    await expect(q).rejects.toThrow(NotFoundError);
  });

  it('find terminal throws NotFoundError on undefined', async () => {
    const q = new InstanceQuery(FakeModel as any, 'find', async () => undefined);
    await expect(q).rejects.toThrow(NotFoundError);
  });

  it('findBy terminal resolves to undefined on miss (does not throw)', async () => {
    const q = new InstanceQuery(FakeModel as any, 'findBy', async () => undefined);
    expect(await q).toBeUndefined();
  });
});
