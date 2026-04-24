import { Suspense, use, useState, useTransition } from 'react';

import { addTodo, loadTodos, removeTodo, toggleTodo } from './db.ts';

const USERS = ['ada', 'linus', 'dennis'];

function TodoList({ user, version }: { user: string; version: number }) {
  // The promise is recreated whenever (user, version) change; React's
  // `use(...)` suspends until it resolves and re-throws on re-render with
  // the new tuple.
  const todos = use(loadTodosCached(user, version));

  const [, startTransition] = useTransition();
  const [, bumpLocal] = useState(0);

  const refresh = () => startTransition(() => bumpLocal((n) => n + 1));

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id} className={t.done ? 'done' : undefined}>
          <input
            type="checkbox"
            checked={t.done}
            onChange={async () => {
              await toggleTodo(user, t.id);
              refresh();
            }}
          />
          <span>{t.text}</span>
          <button
            type="button"
            onClick={async () => {
              await removeTodo(user, t.id);
              refresh();
            }}
          >
            ×
          </button>
        </li>
      ))}
      {todos.length === 0 && <li>(no todos yet — add one below)</li>}
    </ul>
  );
}

const cache = new Map<string, Promise<Awaited<ReturnType<typeof loadTodos>>>>();

function loadTodosCached(user: string, version: number) {
  const key = `${user}#${version}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = loadTodos(user);
    cache.set(key, promise);
    // Drop earlier versions so the cache doesn't grow forever.
    for (const k of cache.keys()) {
      if (k !== key && k.startsWith(`${user}#`)) cache.delete(k);
    }
  }
  return promise;
}

export function App() {
  const [user, setUser] = useState(USERS[0]);
  const [version, setVersion] = useState(0);
  const refreshList = () => setVersion((n) => n + 1);

  return (
    <>
      <h1>NextModel todo</h1>
      <div className="who">
        <label htmlFor="who-select">signed in as:</label>
        <select
          id="who-select"
          value={user}
          onChange={(e) => {
            setUser(e.target.value);
            setVersion(0);
          }}
        >
          {USERS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <Suspense fallback={<p>loading…</p>}>
        <TodoList user={user} version={version} />
      </Suspense>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget as HTMLFormElement;
          const input = form.elements.namedItem('text') as HTMLInputElement;
          const value = input.value.trim();
          if (!value) return;
          await addTodo(user, value);
          input.value = '';
          refreshList();
        }}
      >
        <input name="text" type="text" placeholder="new todo for this user" />
        <button type="submit">add</button>
      </form>
    </>
  );
}
