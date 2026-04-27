import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createTask,
  createUser,
  deleteTask,
  deleteUser,
  loadTasks,
  loadUsers,
  renameUser,
  type TaskRow,
  toggleTask,
  type UserRow,
} from './db';

type Banner = { kind: 'error'; text: string } | { kind: 'info'; text: string } | null;

export function App() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [optimistic, setOptimistic] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);

  // Tombstone counter for optimistic IDs — negative so they never collide
  // with persisted primary keys.
  const tempIdRef = useRef(-1);
  const nextTempId = () => tempIdRef.current--;

  const flash = useCallback((text: string, kind: 'error' | 'info' = 'info') => {
    setBanner({ kind, text });
    const timer = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Initial user load — picks the first user as active.
  useEffect(() => {
    (async () => {
      try {
        const rows = await loadUsers();
        setUsers(rows);
        if (rows[0]) setCurrentUserId(rows[0].id);
      } catch (err) {
        flash(`failed to load users: ${(err as Error).message}`, 'error');
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [flash]);

  // Reload tasks when the active user changes.
  useEffect(() => {
    if (currentUserId == null) {
      setTasks([]);
      return;
    }
    setLoadingTasks(true);
    (async () => {
      try {
        setTasks(await loadTasks(currentUserId));
      } catch (err) {
        flash(`failed to load tasks: ${(err as Error).message}`, 'error');
      } finally {
        setLoadingTasks(false);
      }
    })();
  }, [currentUserId, flash]);

  // ------------------------------------------------------------ Users

  const onAddUser = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (optimistic) {
      const tempId = nextTempId();
      const placeholder: UserRow = { id: tempId, name: trimmed };
      setUsers((u) => [...u, placeholder]);
      try {
        const saved = await createUser(trimmed);
        setUsers((u) => u.map((x) => (x.id === tempId ? saved : x)));
        if (currentUserId === null) setCurrentUserId(saved.id);
      } catch (err) {
        setUsers((u) => u.filter((x) => x.id !== tempId));
        flash(`failed to add user: ${(err as Error).message}`, 'error');
      }
    } else {
      try {
        const saved = await createUser(trimmed);
        setUsers((u) => [...u, saved]);
        if (currentUserId === null) setCurrentUserId(saved.id);
      } catch (err) {
        flash(`failed to add user: ${(err as Error).message}`, 'error');
      }
    }
  };

  const onRenameUser = async (id: number, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    const previous = users.find((u) => u.id === id);
    if (!previous) return;
    if (previous.name === trimmed) return;
    if (optimistic) {
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, name: trimmed } : x)));
    }
    try {
      const saved = await renameUser(id, trimmed);
      setUsers((u) => u.map((x) => (x.id === id ? saved : x)));
    } catch (err) {
      setUsers((u) => u.map((x) => (x.id === id ? previous : x)));
      flash(`rename failed: ${(err as Error).message}`, 'error');
    }
  };

  const onDeleteUser = async (id: number) => {
    if (!confirm(`Delete this user and all their tasks?`)) return;
    const previous = users;
    if (optimistic) {
      setUsers((u) => u.filter((x) => x.id !== id));
      if (currentUserId === id) {
        const survivor = previous.find((u) => u.id !== id) ?? null;
        setCurrentUserId(survivor ? survivor.id : null);
      }
    }
    try {
      await deleteUser(id);
      if (!optimistic) {
        setUsers((u) => u.filter((x) => x.id !== id));
        if (currentUserId === id) {
          const survivor = users.find((u) => u.id !== id) ?? null;
          setCurrentUserId(survivor ? survivor.id : null);
        }
      }
    } catch (err) {
      setUsers(previous);
      flash(`delete failed: ${(err as Error).message}`, 'error');
    }
  };

  // ------------------------------------------------------------ Tasks

  const onAddTask = async (text: string) => {
    if (currentUserId == null) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (optimistic) {
      const tempId = nextTempId();
      const placeholder: TaskRow = {
        id: tempId,
        userId: currentUserId,
        text: trimmed,
        done: false,
      };
      setTasks((t) => [...t, placeholder]);
      try {
        const saved = await createTask(currentUserId, trimmed);
        setTasks((t) => t.map((x) => (x.id === tempId ? saved : x)));
      } catch (err) {
        setTasks((t) => t.filter((x) => x.id !== tempId));
        flash(`failed to add task: ${(err as Error).message}`, 'error');
      }
    } else {
      try {
        const saved = await createTask(currentUserId, trimmed);
        setTasks((t) => [...t, saved]);
      } catch (err) {
        flash(`failed to add task: ${(err as Error).message}`, 'error');
      }
    }
  };

  const onToggleTask = async (id: number) => {
    const previous = tasks.find((t) => t.id === id);
    if (!previous) return;
    if (optimistic) {
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
    }
    try {
      const saved = await toggleTask(id);
      setTasks((t) => t.map((x) => (x.id === id ? saved : x)));
    } catch (err) {
      setTasks((t) => t.map((x) => (x.id === id ? previous : x)));
      flash(`toggle failed: ${(err as Error).message}`, 'error');
    }
  };

  const onDeleteTask = async (id: number) => {
    const previous = tasks;
    if (optimistic) setTasks((t) => t.filter((x) => x.id !== id));
    try {
      await deleteTask(id);
      if (!optimistic) setTasks((t) => t.filter((x) => x.id !== id));
    } catch (err) {
      setTasks(previous);
      flash(`delete failed: ${(err as Error).message}`, 'error');
    }
  };

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  return (
    <>
      <h1>NextModel todo</h1>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      <section className="users">
        <h2>users</h2>
        {loadingUsers ? (
          <p>loading users…</p>
        ) : (
          <ul className="user-list">
            {users.map((u) => (
              <UserRowItem
                key={u.id}
                user={u}
                active={u.id === currentUserId}
                onSelect={() => setCurrentUserId(u.id)}
                onRename={(next) => onRenameUser(u.id, next)}
                onDelete={() => onDeleteUser(u.id)}
              />
            ))}
            {users.length === 0 && <li className="muted">(no users yet — add one below)</li>}
          </ul>
        )}
        <AddForm placeholder="add user" onAdd={onAddUser} />
      </section>

      <section className="tasks">
        <h2>tasks {currentUser && <small>for {currentUser.name}</small>}</h2>
        <label className="optimistic-toggle">
          <input
            type="checkbox"
            checked={optimistic}
            onChange={(e) => setOptimistic(e.target.checked)}
          />
          optimistic updates
        </label>
        {loadingTasks ? (
          <p>loading tasks…</p>
        ) : (
          <ul className="task-list">
            {tasks.map((t) => (
              <TaskRowItem
                key={t.id}
                task={t}
                onToggle={() => onToggleTask(t.id)}
                onDelete={() => onDeleteTask(t.id)}
              />
            ))}
            {tasks.length === 0 && currentUser && (
              <li className="muted">(no tasks for {currentUser.name})</li>
            )}
            {!currentUser && <li className="muted">(create a user first)</li>}
          </ul>
        )}
        {currentUser && (
          <AddForm placeholder={`add task for ${currentUser.name}`} onAdd={onAddTask} />
        )}
      </section>
    </>
  );
}

function UserRowItem({
  user,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  user: UserRow;
  active: boolean;
  onSelect: () => void;
  onRename: (next: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep draft in sync when a rename from elsewhere updates the canonical row.
  useEffect(() => {
    if (!editing) setDraft(user.name);
  }, [editing, user.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== user.name) onRename(next);
  };

  return (
    <li className={active ? 'active' : undefined}>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setDraft(user.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="user-name"
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
          title="double-click to rename"
        >
          {user.name}
        </button>
      )}
      {!editing && (
        <>
          <button type="button" onClick={() => setEditing(true)} title="rename">
            ✎
          </button>
          <button type="button" onClick={onDelete} title="delete user">
            ×
          </button>
        </>
      )}
    </li>
  );
}

function TaskRowItem({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskRow;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={task.done ? 'done' : undefined}>
      <input type="checkbox" checked={task.done} onChange={onToggle} />
      <span className="task-text">{task.text}</span>
      <button type="button" onClick={onDelete} title="delete task">
        ×
      </button>
    </li>
  );
}

function AddForm({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setValue('');
      }}
    >
      <input
        name="text"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">add</button>
    </form>
  );
}
