import { beforeEach, describe, expect, it } from 'vitest';
import { MockSupabaseClient } from '../MockSupabaseClient.js';

describe('MockSupabaseClient', () => {
  let client: MockSupabaseClient;

  beforeEach(() => {
    client = new MockSupabaseClient();
    client.exec('CREATE TABLE cats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)');
  });

  it('inserts and returns representation', async () => {
    const { data, error } = await client
      .from('cats')
      .insert([{ name: 'ada', age: 3 }])
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1, name: 'ada', age: 3 }]);
  });

  it('filters with eq / gte and orders + ranges', async () => {
    await client
      .from('cats')
      .insert([
        { name: 'ada', age: 3 },
        { name: 'bo', age: 7 },
        { name: 'cy', age: 5 },
      ])
      .select();
    const { data } = await client
      .from('cats')
      .select('*')
      .gte('age', 5)
      .order('age', { ascending: false })
      .range(0, 0);
    expect(data).toEqual([{ id: 2, name: 'bo', age: 7 }]);
  });

  it('counts with head', async () => {
    await client
      .from('cats')
      .insert([
        { name: 'ada', age: 3 },
        { name: 'bo', age: 7 },
      ])
      .select();
    const { count } = await client
      .from('cats')
      .select('*', { count: 'exact', head: true })
      .gt('age', 4);
    expect(count).toBe(1);
  });

  it('updates matching rows and returns them', async () => {
    await client
      .from('cats')
      .insert([{ name: 'ada', age: 3 }])
      .select();
    const { data } = await client.from('cats').update({ age: 4 }).eq('name', 'ada').select();
    expect(data).toEqual([{ id: 1, name: 'ada', age: 4 }]);
  });

  it('deletes matching rows and returns them', async () => {
    await client
      .from('cats')
      .insert([{ name: 'ada', age: 3 }])
      .select();
    const { data } = await client.from('cats').delete().eq('name', 'ada').select();
    expect(data).toEqual([{ id: 1, name: 'ada', age: 3 }]);
    const { count } = await client.from('cats').select('*', { count: 'exact', head: true });
    expect(count).toBe(0);
  });

  it('upserts on conflict target', async () => {
    client.exec('CREATE TABLE items (slug TEXT PRIMARY KEY, name TEXT)');
    await client
      .from('items')
      .insert([{ slug: 'a', name: 'first' }])
      .select();
    const { data } = await client
      .from('items')
      .upsert([{ slug: 'a', name: 'second' }], { onConflict: 'slug' })
      .select();
    expect(data).toEqual([{ slug: 'a', name: 'second' }]);
  });

  it("not('col', 'eq', v) excludes the matching row", async () => {
    await client.from('cats').insert([
      { name: 'ada', age: 3 },
      { name: 'bo', age: 7 },
      { name: 'cy', age: 5 },
    ]);
    const { error, data } = await client
      .from('cats')
      .select('*')
      .not('name', 'eq', 'ada')
      .order('name');
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: 2, name: 'bo', age: 7 },
      { id: 3, name: 'cy', age: 5 },
    ]);
  });

  it("not('col', 'in', '(a,b)') excludes the PostgREST string list", async () => {
    await client.from('cats').insert([
      { name: 'ada', age: 3 },
      { name: 'bo', age: 7 },
      { name: 'cy', age: 5 },
    ]);
    const { error, data } = await client
      .from('cats')
      .select('*')
      .not('name', 'in', '(ada,bo)')
      .order('name');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 3, name: 'cy', age: 5 }]);
  });

  it("not('col', 'is', null) returns only rows with a non-null value", async () => {
    await client.from('cats').insert([
      { name: 'ada', age: 3 },
      { name: null, age: 9 },
      { name: 'cy', age: 5 },
    ]);
    const { error, data } = await client
      .from('cats')
      .select('*')
      .not('name', 'is', null)
      .order('name');
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: 1, name: 'ada', age: 3 },
      { id: 3, name: 'cy', age: 5 },
    ]);
  });
});
