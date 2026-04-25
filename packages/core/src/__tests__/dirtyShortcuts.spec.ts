import { KeyType, MemoryConnector, Model, type Storage } from '../index.js';

describe('dirty-tracking shortcuts', () => {
  let storage: Storage = {};
  const tableName = 'posts';
  const connector = () => new MemoryConnector({ storage });

  const Post = () =>
    Model({
      tableName,
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ title: '' as string, body: '' as string, score: 0 }),
    });

  beforeEach(() => {
    storage = {
      [tableName]: [
        { id: 1, title: 'Hello', body: 'World', score: 1 },
        { id: 2, title: 'Two', body: 'Body', score: 2 },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  describe('#was(key)', () => {
    it('returns the prior value when the attribute is changed', async () => {
      const post = await Post().find(1);
      post!.title = 'Changed';
      expect(post!.was('title')).toBe('Hello');
    });

    it('returns the current value when the attribute is unchanged', async () => {
      const post = await Post().find(1);
      expect(post!.was('title')).toBe('Hello');
      expect(post!.was('body')).toBe('World');
    });

    it('returns the current value after revertChange', async () => {
      const post = await Post().find(1);
      post!.title = 'Changed';
      post!.revertChange('title');
      expect(post!.was('title')).toBe('Hello');
    });

    it('returns the latest value after reload (clears change state)', async () => {
      const post = await Post().find(1);
      post!.title = 'Changed';
      await post!.reload();
      expect(post!.was('title')).toBe('Hello');
    });
  });

  describe('#changeBy(key)', () => {
    it('returns { from, to } when changed', async () => {
      const post = await Post().find(1);
      post!.title = 'Changed';
      expect(post!.changeBy('title')).toEqual({ from: 'Hello', to: 'Changed' });
    });

    it('returns undefined when unchanged', async () => {
      const post = await Post().find(1);
      expect(post!.changeBy('title')).toBeUndefined();
    });

    it('returns undefined after revertChange', async () => {
      const post = await Post().find(1);
      post!.title = 'Changed';
      post!.revertChange('title');
      expect(post!.changeBy('title')).toBeUndefined();
    });
  });

  describe('#savedWas(key)', () => {
    it('returns the value the record had immediately before the last save', async () => {
      const post = await Post().find(1);
      post!.title = 'After';
      await post!.save();
      expect(post!.savedWas('title')).toBe('Hello');
    });

    it('returns the current value when the attribute was not in the last save', async () => {
      const post = await Post().find(1);
      post!.title = 'After';
      await post!.save();
      expect(post!.savedWas('body')).toBe('World');
    });

    it('returns the current value when no save has happened on this instance', async () => {
      const post = await Post().find(1);
      expect(post!.savedWas('title')).toBe('Hello');
    });
  });

  describe('regression: existing dirty surface', () => {
    it('continues to expose changes() / savedChanges() / wasChangedBy / savedChangeBy', async () => {
      const post = await Post().find(1);
      post!.title = 'Changed';
      expect(post!.changes()).toEqual({ title: { from: 'Hello', to: 'Changed' } });
      await post!.save();
      expect(post!.changes()).toEqual({});
      expect(post!.wasChangedBy('title')).toBe(true);
      expect(post!.savedChangeBy('title')).toEqual({ from: 'Hello', to: 'Changed' });
    });
  });
});
