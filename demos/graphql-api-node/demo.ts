import { makeExecutableSchema } from '@graphql-tools/schema';
import { Model } from '@next-model/core';
import { buildModelResource, composeSchema } from '@next-model/graphql-api';
import { SqliteConnector } from '@next-model/sqlite-connector';
import express, { type Request } from 'express';
import { createHandler } from 'graphql-http/lib/use/express';

const connector = new SqliteConnector(':memory:');

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string; role: 'admin' | 'member'; active: boolean }) => props,
}) {}

await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.string('role');
  t.boolean('active', { default: true });
});

await User.createMany([
  { name: 'Ada', role: 'admin', active: true },
  { name: 'Linus', role: 'member', active: true },
  { name: 'Old Account', role: 'member', active: false },
]);

interface Ctx {
  role?: 'admin' | 'member';
}

const userResource = buildModelResource<Ctx>({
  Model: User,
  name: 'User',
  fields: {
    id: { type: 'Int!' },
    name: { type: 'String!' },
    role: { type: 'String!' },
    active: { type: 'Boolean!' },
  },
  authorize: ({ context }) => !!context.role,
  operations: {
    delete: { authorize: ({ context }) => context.role === 'admin' },
  },
  serialize: (row, ctx) => {
    const attrs = (
      row as { attributes: () => { id: number; name: string; role: string; active: boolean } }
    ).attributes();
    if (ctx.context.role === 'admin') return attrs;
    // Members don't see the `active` flag.
    const { active: _hidden, ...rest } = attrs;
    return rest;
  },
});

const { typeDefs, resolvers } = composeSchema([userResource]);
const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
app.use(express.json());
app.use(
  '/graphql',
  createHandler({
    schema,
    context: (req: Request): Ctx => ({
      role: (req.headers['x-role'] as 'admin' | 'member') ?? undefined,
    }),
  }),
);

const server = app.listen(0, async () => {
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}/graphql`;
  console.log(`listening on ${url}`);

  async function query(source: string, role?: string) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/graphql-response+json, application/json',
        ...(role ? { 'x-role': role } : {}),
      },
      body: JSON.stringify({ query: source }),
    });
    return res.json();
  }

  console.log('no auth →', await query('{ users { items { name } meta { hasMore } } }'));

  console.log(
    'member list (no `active` field) →',
    await query('{ users { items { name role } meta { hasMore } } }', 'member'),
  );

  console.log(
    'admin list filtered role=member →',
    await query(
      '{ users(filter: { role: "member" }) { items { name role active } meta { total } } }',
      'admin',
    ),
  );

  console.log(
    'admin create →',
    await query(
      'mutation { createUser(input: { name: "Grace", role: "admin", active: true }) { id name } }',
      'admin',
    ),
  );

  console.log(
    'member delete → UNAUTHORIZED',
    await query('mutation { deleteUser(id: 4) }', 'member'),
  );

  console.log('admin delete →', await query('mutation { deleteUser(id: 4) }', 'admin'));

  server.close();
  connector.destroy();
});
