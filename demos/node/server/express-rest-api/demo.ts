import { defineSchema, Model } from '@next-model/core';
import { createRestRouter } from '@next-model/express-rest-api';
import { SqliteConnector } from '@next-model/sqlite-connector';
import express, { type Request } from 'express';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      role: { type: 'string' },
      active: { type: 'boolean', default: true },
    },
  },
});

// In-memory sqlite so the demo boots with zero infra and wipes on exit.
const connector = new SqliteConnector(':memory:', { schema });

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
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

// A tiny auth shim — in a real app this is probably a JWT/session middleware.
// Demo: send `x-role: admin` to act as an admin; otherwise you're a member.
function requireAuth(req: Request): 'admin' | 'member' {
  const role = req.get('x-role');
  return role === 'admin' ? 'admin' : 'member';
}

const app = express();
app.set('query parser', 'extended');
app.use(express.json());

app.use(
  '/users',
  createRestRouter(User, {
    // Every request needs an `x-role` header. Missing → 401.
    authorize: ({ req }) => !!req.get('x-role'),
    actions: {
      // Deletes are admin-only.
      delete: { authorize: ({ req }) => requireAuth(req) === 'admin' },
      // Hide the `active` flag from non-admins by returning an admin-only field.
      show: {},
    },
    // Strip sensitive fields + rename the primary key to `uid` in the payload.
    serialize: (row, ctx) => {
      const attrs = row.attributes as { id: number; name: string; role: string; active: boolean };
      const base = { uid: attrs.id, name: attrs.name, role: attrs.role };
      if (requireAuth(ctx.req) === 'admin') {
        return { ...base, active: attrs.active };
      }
      return base;
    },
    envelope: ({ action, data, meta }) => ({ action, data, meta }),
  }),
);

const server = app.listen(0, async () => {
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  console.log(`listening on ${base}`);

  const member = { 'x-role': 'member' };
  const admin = { 'x-role': 'admin' };

  const noAuth = await fetch(`${base}/users`);
  console.log('no auth →', noAuth.status);

  const list = await fetch(`${base}/users`, { headers: member }).then((r) => r.json());
  console.log('member list →', list);

  const ada = await fetch(`${base}/users/1`, { headers: member }).then((r) => r.json());
  console.log('member show (ada, no active flag) →', ada);

  const adaAsAdmin = await fetch(`${base}/users/1`, { headers: admin }).then((r) => r.json());
  console.log('admin show (ada, with active flag) →', adaAsAdmin);

  const filtered = await fetch(
    `${base}/users?filter=${encodeURIComponent(JSON.stringify({ role: 'member' }))}`,
    {
      headers: admin,
    },
  ).then((r) => r.json());
  console.log('admin list filtered role=member →', filtered);

  const count = await fetch(`${base}/users/count`, { headers: admin }).then((r) => r.json());
  console.log('admin count →', count);

  const created = await fetch(`${base}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...admin },
    body: JSON.stringify({ name: 'Grace', role: 'admin', active: true }),
  });
  console.log('admin create →', created.status, await created.json());

  const deleteAsMember = await fetch(`${base}/users/4`, { method: 'DELETE', headers: member });
  console.log('member delete → (401)', deleteAsMember.status);

  const deleteAsAdmin = await fetch(`${base}/users/4`, { method: 'DELETE', headers: admin });
  console.log('admin delete →', deleteAsAdmin.status);

  server.close();
  connector.destroy();
});
