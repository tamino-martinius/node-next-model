import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string', default: '' },
    },
  },
});

describe('transactional callbacks (afterCommit / afterRollback)', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage }, { schema });

  function makePost() {
    return Model({
      tableName: 'posts',
      connector: connector(),
      init: (p: { title?: string }) => ({ title: p.title ?? '' }),
    });
  }

  beforeEach(() => {
    storage = { posts: [{ id: 1, title: 'Existing' }] };
  });

  afterEach(() => {
    storage = {};
  });

  describe('outside a transaction (auto-commit semantics)', () => {
    it('afterCommit fires immediately after a successful save', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterCommit', () => {
        calls.push('commit');
      });
      Post.on('afterCreateCommit', () => {
        calls.push('createCommit');
      });
      await Post.create({ title: 'Fresh' });
      expect(calls).toEqual(['createCommit', 'commit']);
    });

    it('afterUpdateCommit fires on update', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterUpdateCommit', () => {
        calls.push('updateCommit');
      });
      const p = (await Post.find(1)) as any;
      p.title = 'Updated';
      await p.save();
      expect(calls).toEqual(['updateCommit']);
    });

    it('afterDeleteCommit fires on delete', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterDeleteCommit', () => {
        calls.push('deleteCommit');
      });
      const p = (await Post.find(1)) as any;
      await p.delete();
      expect(calls).toEqual(['deleteCommit']);
    });

    it('afterRollback never fires when no transaction is active', async () => {
      const Post = makePost();
      let rollbackCalls = 0;
      Post.on('afterRollback', () => {
        rollbackCalls++;
      });
      await Post.create({ title: 'Fresh' });
      expect(rollbackCalls).toBe(0);
    });
  });

  describe('inside Model.transaction', () => {
    it('afterCommit fires AFTER the transaction body completes successfully', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterCommit', () => {
        calls.push('commit');
      });
      Post.on('afterCreate', () => {
        calls.push('create');
      });

      await Post.transaction(async () => {
        await Post.create({ title: 'A' });
        await Post.create({ title: 'B' });
        // afterCreate fires for each save inside the transaction.
        // afterCommit must NOT fire yet.
        expect(calls).toEqual(['create', 'create']);
      });
      // After commit: 2 commit callbacks drain.
      expect(calls).toEqual(['create', 'create', 'commit', 'commit']);
    });

    it('afterRollback fires when the transaction throws; afterCommit does not', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterCommit', () => {
        calls.push('commit');
      });
      Post.on('afterRollback', () => {
        calls.push('rollback');
      });
      Post.on('afterCreateRollback', () => {
        calls.push('createRollback');
      });

      await expect(
        Post.transaction(async () => {
          await Post.create({ title: 'doomed' });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(calls).toEqual(['createRollback', 'rollback']);
      expect(calls).not.toContain('commit');
    });

    it('queued callbacks see the post-commit state (record is persistent + has id)', async () => {
      const Post = makePost();
      let observed: { isPersistent: boolean; id: any } | undefined;
      const Spy = makePost();
      Spy.on('afterCommit', (record: any) => {
        observed = { isPersistent: record.isPersistent(), id: record.id };
      });
      const created = (await Spy.transaction(async () => {
        return Spy.create({ title: 'X' });
      })) as any;
      expect(observed).toEqual({ isPersistent: true, id: created.id });
      void Post;
    });

    it('a per-callback failure during afterRollback does not mask the original error', async () => {
      const Post = makePost();
      Post.on('afterRollback', () => {
        throw new Error('rollback handler boom');
      });
      await expect(
        Post.transaction(async () => {
          await Post.create({ title: 'X' });
          throw new Error('original');
        }),
      ).rejects.toThrow('original');
    });

    it('nested Model.transaction uses the outer commit queue (single drain)', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterCommit', () => {
        calls.push('commit');
      });
      await Post.transaction(async () => {
        await Post.create({ title: 'outer' });
        await Post.transaction(async () => {
          await Post.create({ title: 'inner' });
        });
        expect(calls).toEqual([]);
      });
      // Two saves → two commit callbacks, drained once at the outer commit.
      expect(calls).toEqual(['commit', 'commit']);
    });
  });
});
