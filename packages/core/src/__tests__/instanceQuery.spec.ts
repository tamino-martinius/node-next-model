import { describe, expect, it } from 'vitest';
import { InstanceQuery } from '../query/InstanceQuery.js';
import { NotFoundError } from '../errors.js';
import type { TerminalKind } from '../query/InstanceQuery.js';

const FakeModel = { tableName: 'users', keys: { id: 1 } };

// Stub-driven tests: Task 24 will replace materialize() with the real
// queryScoped path. These guard the thenable interface stays intact.
class StubMaterialize<Result> extends InstanceQuery<Result> {
  constructor(
    model: any,
    terminalKind: TerminalKind,
    private readonly stub: () => Promise<Result | undefined>,
  ) {
    super(model, terminalKind, {
      Model: model,
      order: [],
      selectedIncludes: [],
      includeStrategy: 'preload',
      pendingJoins: [],
      softDelete: false,
    });
  }

  protected materialize(): Promise<Result> {
    if (!this.memo) {
      this.memo = this.stub().then((result) => {
        if (
          result === undefined &&
          (this.terminalKind === 'find' || this.terminalKind === 'findOrFail')
        ) {
          const label = this.model.tableName || 'Record';
          throw new NotFoundError(`${label} not found`);
        }
        return result as Result;
      });
    }
    return this.memo;
  }
}

describe('InstanceQuery', () => {
  it('resolves to undefined when execute returns undefined', async () => {
    const q = new StubMaterialize(FakeModel as any, 'first', async () => undefined);
    expect(await q).toBeUndefined();
  });

  it('resolves to the record when execute returns one', async () => {
    const q = new StubMaterialize(FakeModel as any, 'first', async () => ({ id: 1 }));
    expect(await q).toEqual({ id: 1 });
  });

  it('findOrFail terminal throws NotFoundError on undefined', async () => {
    const q = new StubMaterialize(FakeModel as any, 'findOrFail', async () => undefined);
    await expect(q).rejects.toThrow(NotFoundError);
  });

  it('find terminal throws NotFoundError on undefined', async () => {
    const q = new StubMaterialize(FakeModel as any, 'find', async () => undefined);
    await expect(q).rejects.toThrow(NotFoundError);
  });

  it('findBy terminal resolves to undefined on miss (does not throw)', async () => {
    const q = new StubMaterialize(FakeModel as any, 'findBy', async () => undefined);
    expect(await q).toBeUndefined();
  });
});
