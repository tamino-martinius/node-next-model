import { defineSchema, Model } from '@next-model/core';
import { SupabaseConnector } from '@next-model/supabase-connector';
import { MockSupabaseClient } from '@next-model/supabase-connector/mock-client';

const client = new MockSupabaseClient();
client.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)');

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer' },
    },
  },
});

const connector = new SupabaseConnector(client, { schema });
class User extends Model({ connector, tableName: 'users' }) {}

const ada = await User.create({ name: 'Ada', age: 36 });
console.log('created', ada.id, ada.name);
console.log('adults', await User.filterBy({ $gte: { age: 18 } }).count());
client.close();
