import { cookies } from 'next/headers';

import { addTask, deleteTask, setCurrentUser, toggleTask } from './actions';
import { dbReady, Task, User } from './db';

const USER_COOKIE = 'nm-todo-user';

export default async function Page() {
  await dbReady;
  const jar = await cookies();
  const users = await User.all();
  const currentName = jar.get(USER_COOKIE)?.value ?? users[0]?.name;
  const currentUser = users.find((u) => u.name === currentName) ?? users[0];

  const tasks = currentUser
    ? await Task.filterBy({ userId: currentUser.id }).orderBy({ key: 'id' }).all()
    : [];

  return (
    <>
      <h1>NextModel todo · Next.js</h1>
      <p style={{ color: '#888', fontSize: '0.9rem' }}>
        Server components calling <code>@next-model/sqlite-connector</code> directly. State lives in
        the same on-disk sqlite file that survives <code>next dev</code> reloads.
      </p>

      <section style={{ margin: '1.5rem 0' }}>
        <strong>signed in as: {currentUser?.name ?? '(no users)'}</strong>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
          {users.map((u) => (
            <form key={u.id} action={setCurrentUser.bind(null, u.name)}>
              <button
                type="submit"
                style={{
                  padding: '0.25rem 0.6rem',
                  fontWeight: u.name === currentUser?.name ? 'bold' : 'normal',
                }}
              >
                {u.name}
              </button>
            </form>
          ))}
        </div>
      </section>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((t) => (
          <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <form action={toggleTask}>
              <input type="hidden" name="id" value={t.id} />
              <button type="submit" style={{ width: '1.5rem' }}>
                {t.done ? '☑' : '☐'}
              </button>
            </form>
            <span style={{ textDecoration: t.done ? 'line-through' : undefined, flex: 1 }}>
              {t.title}
            </span>
            <form action={deleteTask}>
              <input type="hidden" name="id" value={t.id} />
              <button type="submit">×</button>
            </form>
          </li>
        ))}
        {tasks.length === 0 && (
          <li style={{ color: '#888' }}>(no tasks for {currentUser?.name})</li>
        )}
      </ul>

      {currentUser && (
        <form action={addTask} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <input type="hidden" name="userId" value={currentUser.id} />
          <input
            name="title"
            type="text"
            placeholder={`new task for ${currentUser.name}`}
            style={{ flex: 1, padding: '0.4rem 0.6rem' }}
          />
          <button type="submit" style={{ padding: '0.4rem 0.8rem' }}>
            add
          </button>
        </form>
      )}
    </>
  );
}
