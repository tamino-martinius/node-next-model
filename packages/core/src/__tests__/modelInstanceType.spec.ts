import { describe, expect, expectTypeOf, it } from 'vitest';

import { defineSchema, MemoryConnector, Model } from '../index.js';

const schema = defineSchema({
  messages: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      body: { type: 'string' },
      author: { type: 'string', null: true },
    },
  },
});

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
}

class Message extends Model({ tableName: 'messages', connector: freshConnector() }) {
  // A static returning the hydrated instance shape. Without `typeof Message.Instance`
  // callers would need a local `Awaited<ReturnType<typeof Message.create>>` alias.
  static async newest(): Promise<typeof Message.Instance | undefined> {
    return Message.last();
  }

  // A static taking the hydrated instance shape as a parameter.
  static label(m: typeof Message.Instance): string {
    return `${m.id}: ${m.body}`;
  }
}

describe('Model.Instance phantom type', () => {
  it('typechecks column getters on the hydrated instance shape', async () => {
    const created = await Message.create({ body: 'hello', author: 'ada' });
    // Compile-time: assigning a hydrated record to typeof Message.Instance
    // must accept all known column getters.
    const m: typeof Message.Instance = created;
    expectTypeOf(m.id).toEqualTypeOf<number>();
    expectTypeOf(m.body).toEqualTypeOf<string>();
    // author is nullable in the schema.
    expectTypeOf(m.author).toEqualTypeOf<string | null | undefined>();
    expect(m.body).toBe('hello');
  });

  it('round-trips through user-defined statics that name typeof Model.Instance', async () => {
    await Message.create({ body: 'first' });
    await Message.create({ body: 'second' });
    const latest = await Message.newest();
    expect(latest).toBeDefined();
    if (latest) {
      // Pass the hydrated record back through a static expecting Instance.
      expect(Message.label(latest)).toMatch(/^\d+: second$/);
    }
  });

  it('rejects access to a non-existent column at compile time', async () => {
    const created = await Message.create({ body: 'x' });
    const m: typeof Message.Instance = created;
    // @ts-expect-error — `nope` is not declared on the schema.
    void m.nope;
    expect(m.body).toBe('x');
  });

  it('runtime value of Model.Instance is undefined (phantom)', () => {
    expect((Message as { Instance?: unknown }).Instance).toBeUndefined();
  });
});
