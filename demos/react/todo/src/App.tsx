import { useInvalidateKeys, useModel } from '@next-model/react';
import { useState } from 'react';
import { Task, User } from './db.js';

export function App() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const users = useModel(User).orderBy({ key: 'id' }).watch({ keys: ['users'] });
  if (users.isLoading) return <p>loading users…</p>;

  const userList = users.data as InstanceType<typeof User>[];
  const activeId = currentUserId ?? (userList[0] as { id?: number } | undefined)?.id ?? null;

  return (
    <>
      <h1>NextModel todo</h1>
      <UserList users={userList} activeId={activeId} onSelect={setCurrentUserId} />
      {activeId != null && <Tasks userId={activeId} />}
    </>
  );
}

function UserList({
  users,
  activeId,
  onSelect,
}: {
  users: InstanceType<typeof User>[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const newUser = useModel(User).build({ name: '' });
  const invalidate = useInvalidateKeys();
  return (
    <section className="users">
      <h2>users</h2>
      <ul className="user-list">
        {users.map((u) => {
          const id = (u as unknown as { id: number }).id;
          const name = (u as unknown as { name: string }).name;
          return (
            <li key={id} className={id === activeId ? 'active' : undefined}>
              <button type="button" className="user-name" onClick={() => onSelect(id)}>{name}</button>
              <button
                type="button"
                onClick={async () => {
                  await Task.filterBy({ userId: id }).deleteAll();
                  await u.delete();
                  invalidate(['users']);
                }}
                title="delete user"
              >×</button>
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newUser.name?.trim()) return;
          await newUser.save();
          invalidate(['users']);
          newUser.reset({ name: '' });
        }}
      >
        <input
          name="name"
          type="text"
          placeholder="add user"
          value={newUser.name ?? ''}
          onChange={(e) => { newUser.name = e.target.value; }}
        />
        <button type="submit">add</button>
      </form>
    </section>
  );
}

function Tasks({ userId }: { userId: number }) {
  const tasks = useModel(Task).filterBy({ userId }).orderBy({ key: 'id' }).watch({
    keys: [`tasks-user:${userId}`],
  });
  const newTask = useModel(Task).build({ userId, done: false, text: '' });
  const invalidate = useInvalidateKeys();
  if (tasks.isLoading) return <p>loading tasks…</p>;
  const taskList = tasks.data as InstanceType<typeof Task>[];
  return (
    <section className="tasks">
      <h2>tasks</h2>
      <ul className="task-list">
        {taskList.map((t) => {
          const id = (t as unknown as { id: number }).id;
          const text = (t as unknown as { text: string }).text;
          const done = (t as unknown as { done: boolean }).done;
          return (
            <li key={id} className={done ? 'done' : undefined}>
              <input
                type="checkbox"
                checked={done}
                onChange={async () => {
                  (t as unknown as { done: boolean }).done = !done;
                  await t.save();
                }}
              />
              <span className="task-text">{text}</span>
              <button
                type="button"
                onClick={async () => {
                  await t.delete();
                  invalidate([`tasks-user:${userId}`]);
                }}
                title="delete task"
              >×</button>
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newTask.text?.trim()) return;
          await newTask.save();
          invalidate([`tasks-user:${userId}`]);
          newTask.reset({ userId, done: false, text: '' });
        }}
      >
        <input
          name="text"
          type="text"
          placeholder="add task"
          value={newTask.text ?? ''}
          onChange={(e) => { newTask.text = e.target.value; }}
        />
        <button type="submit">add</button>
      </form>
    </section>
  );
}
