import { cookies } from 'next/headers';
import { dbReady, Task, User } from './db';
import { TaskList, type TaskRow } from './TaskList';
import { UserList, type UserRow } from './UserList';

const USER_COOKIE = 'nm-todo-user';

export default async function Page() {
  await dbReady;
  const jar = await cookies();

  const userInstances = await User.orderBy({ key: 'id' }).all();
  const users: UserRow[] = userInstances.map((u) => {
    const attrs = u.attributes as { id: number; name: string };
    return { id: attrs.id, name: attrs.name };
  });

  const cookieName = jar.get(USER_COOKIE)?.value;
  const currentUser = users.find((u) => u.name === cookieName) ?? users[0];

  let tasks: TaskRow[] = [];
  if (currentUser) {
    const taskInstances = await Task.filterBy({ userId: currentUser.id })
      .orderBy({ key: 'id' })
      .all();
    tasks = taskInstances.map((t) => {
      const attrs = t.attributes as {
        id: number;
        userId: number;
        title: string;
        done: boolean;
      };
      return { id: attrs.id, userId: attrs.userId, title: attrs.title, done: attrs.done };
    });
  }

  return (
    <>
      <h1>NextModel todo · Next.js</h1>
      <p className="lede">
        Server components call <code>@next-model/sqlite-connector</code> directly; server actions
        persist every mutation. Client components wrap the lists with <code>useOptimistic</code> so
        inserts / toggles / deletes show up before the server round trip completes.
      </p>

      <UserList users={users} currentUserName={currentUser?.name} />
      <TaskList tasks={tasks} userId={currentUser?.id ?? null} userName={currentUser?.name} />
    </>
  );
}
