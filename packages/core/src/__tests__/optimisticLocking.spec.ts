import { KeyType, MemoryConnector, Model, StaleObjectError, type Storage } from '../index.js';

describe('optimistic locking', () => {
  let storage: Storage = {};
  const tableName = 'posts';
  const connector = () => new MemoryConnector({ storage });

  function makePost(opts: { lockVersion?: boolean | string } = { lockVersion: true }) {
    return Model({
      tableName,
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ title: '' as string, lockVersion: 0, version: 0 }),
      lockVersion: opts.lockVersion,
    });
  }

  beforeEach(() => {
    storage = {
      [tableName]: [
        { id: 1, title: 'Hello', lockVersion: 0, version: 0 },
        { id: 2, title: 'Two', lockVersion: 0, version: 0 },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('exposes lockVersionColumn on the Model', () => {
    expect(makePost().lockVersionColumn).toBe('lockVersion');
    expect(makePost({ lockVersion: 'version' }).lockVersionColumn).toBe('version');
  });

  it('inserts default the lockVersion column to 0', async () => {
    const Post = makePost();
    const post = Post.build({ title: 'Fresh' });
    await post.save();
    expect((post as any).lockVersion).toBe(0);
    expect(storage[tableName].find((r) => r.id === post.id)?.lockVersion).toBe(0);
  });

  it('successful update increments lockVersion in memory and storage', async () => {
    const Post = makePost();
    const a = await Post.find(1);
    a!.title = 'A';
    await a!.save();
    expect((a! as any).lockVersion).toBe(1);
    expect(storage[tableName].find((r) => r.id === 1)?.lockVersion).toBe(1);
  });

  it('throws StaleObjectError on concurrent update', async () => {
    const Post = makePost();
    const a = await Post.find(1);
    const b = await Post.find(1);
    a!.title = 'A';
    await a!.save();
    b!.title = 'B';
    await expect(b!.save()).rejects.toBeInstanceOf(StaleObjectError);
    expect(storage[tableName].find((r) => r.id === 1)?.title).toBe('A');
  });

  it('after reload, the stale instance can save successfully', async () => {
    const Post = makePost();
    const a = await Post.find(1);
    const b = await Post.find(1);
    a!.title = 'A';
    await a!.save();
    b!.title = 'B';
    await expect(b!.save()).rejects.toBeInstanceOf(StaleObjectError);
    await b!.reload();
    expect((b! as any).lockVersion).toBe(1);
    b!.title = 'B';
    await b!.save();
    expect(storage[tableName].find((r) => r.id === 1)?.title).toBe('B');
    expect(storage[tableName].find((r) => r.id === 1)?.lockVersion).toBe(2);
  });

  it('throws StaleObjectError on concurrent delete', async () => {
    const Post = makePost();
    const a = await Post.find(1);
    const b = await Post.find(1);
    a!.title = 'A';
    await a!.save();
    await expect(b!.delete()).rejects.toBeInstanceOf(StaleObjectError);
    expect(storage[tableName].find((r) => r.id === 1)).toBeDefined();
  });

  it('honours a custom column name', async () => {
    const Post = makePost({ lockVersion: 'version' });
    const a = await Post.find(1);
    const b = await Post.find(1);
    a!.title = 'A';
    await a!.save();
    expect(storage[tableName].find((r) => r.id === 1)?.version).toBe(1);
    b!.title = 'B';
    await expect(b!.save()).rejects.toBeInstanceOf(StaleObjectError);
  });

  it('Models without lockVersion are unaffected', async () => {
    const Post = Model({
      tableName,
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ title: '' as string, lockVersion: 0, version: 0 }),
    });
    expect(Post.lockVersionColumn).toBeUndefined();
    const a = await Post.find(1);
    const b = await Post.find(1);
    a!.title = 'A';
    await a!.save();
    b!.title = 'B';
    await b!.save(); // no error — last writer wins
    expect(storage[tableName].find((r) => r.id === 1)?.title).toBe('B');
  });
});
