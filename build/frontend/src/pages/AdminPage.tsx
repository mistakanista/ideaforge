import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RoleGuard } from '../components/RoleGuard';
import { OFFICE_LABELS, ROLE_LABELS } from '../config';
import { repository, RuleViolation } from '../data';
import { useCurrentUser } from '../session/CurrentUser';
import type { Category, CategoryInput, UserRole } from '../types';

type Message = { kind: 'success' | 'error'; text: string } | null;

function errorMessage(err: unknown): string {
  return err instanceof RuleViolation ? err.message : 'Something went wrong. Please try again.';
}

function MessageLine({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={message.kind === 'error' ? 'form-error' : 'success-line'} role={message.kind === 'error' ? 'alert' : 'status'}>
      {message.text}
    </p>
  );
}

function UsersSection() {
  const { authMode, user: me, users, actAs, refreshUsers } = useCurrentUser();
  const canActAs = authMode === 'mock';
  const [message, setMessage] = useState<Message>(null);
  const activeAdmins = users.filter((u) => u.role === 'ADMIN' && u.is_active).length;

  async function changeRole(userId: number, role: UserRole) {
    if (!me) return;
    try {
      await repository.updateUserRole(userId, role, me);
      await refreshUsers();
      const name = users.find((u) => u.user_id === userId)?.display_name;
      setMessage({ kind: 'success', text: `${name} is now ${ROLE_LABELS[role]}.` });
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    }
  }

  return (
    <section className="card admin-section" aria-labelledby="users-heading">
      <h2 id="users-heading">Users</h2>
      <p className="muted">
        Change roles, for example to make someone a reviewer.
        {canActAs
          ? ' Use “Act as” to test the app as that user.'
          : ' Note: until the ideas are stored in Supabase, role changes here only affect the demo data. Real roles are changed in Supabase.'}
      </p>
      <MessageLine message={message} />
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Office</th>
              <th scope="col">Role</th>
              {canActAs && <th scope="col">Test</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const lastAdmin = u.role === 'ADMIN' && activeAdmins === 1;
              return (
                <tr key={u.user_id}>
                  <th scope="row">
                    {u.display_name}
                    {u.user_id === me?.user_id && <span className="muted small"> (you)</span>}
                  </th>
                  <td>{u.email}</td>
                  <td>{OFFICE_LABELS[u.office]}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`role-${u.user_id}`}>
                      Role of {u.display_name}
                    </label>
                    <select
                      id={`role-${u.user_id}`}
                      value={u.role}
                      disabled={lastAdmin}
                      aria-describedby={lastAdmin ? 'last-admin-hint' : undefined}
                      onChange={(e) => void changeRole(u.user_id, e.target.value as UserRole)}
                    >
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  {canActAs && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        disabled={u.user_id === me?.user_id}
                        onClick={() => actAs(u.user_id)}
                      >
                        Act as
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {activeAdmins === 1 && (
        <p id="last-admin-hint" className="hint">
          The last admin cannot be changed to another role. Make someone else admin first.
        </p>
      )}
    </section>
  );
}

const EMPTY_CATEGORY: CategoryInput = { name: '', description: '', is_active: true };

function CategoriesSection() {
  const { user: me } = useCurrentUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<CategoryInput | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => setCategories(await repository.listCategories()), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(input: CategoryInput) {
    if (!me) return;
    try {
      const saved = await repository.saveCategory(input, me);
      await load();
      setEditing(null);
      setMessage({ kind: 'success', text: `Category “${saved.name}” saved.` });
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) void save(editing);
  }

  return (
    <section className="card admin-section" aria-labelledby="categories-heading">
      <div className="section-head">
        <h2 id="categories-heading">Categories</h2>
        {!editing && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditing(EMPTY_CATEGORY); setMessage(null); }}>
            <span aria-hidden="true">+</span> Add category
          </button>
        )}
      </div>
      <p className="muted">Inactive categories can no longer be chosen for new ideas. Existing ideas keep their category.</p>
      <MessageLine message={message} />

      {editing && (
        <form className="category-form" onSubmit={handleSubmit}>
          <h3>{editing.category_id === undefined ? 'New category' : `Edit “${categories.find((c) => c.category_id === editing.category_id)?.name}”`}</h3>
          <div className="field">
            <label htmlFor="cat-name">Name (required)</label>
            <input id="cat-name" type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cat-description">Description</label>
            <textarea
              id="cat-description"
              rows={2}
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            Active
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save category
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Description</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.category_id} className={c.is_active ? undefined : 'inactive'}>
                <th scope="row">{c.name}</th>
                <td>{c.description}</td>
                <td>{c.is_active ? 'Active' : 'Inactive'}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                      setEditing({ category_id: c.category_id, name: c.name, description: c.description, is_active: c.is_active });
                      setMessage(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => void save({ category_id: c.category_id, name: c.name, description: c.description, is_active: !c.is_active })}
                  >
                    {c.is_active ? 'Mark inactive' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminPage() {
  return (
    <RoleGuard roles={['ADMIN']}>
      <h1>Admin</h1>
      <p className="muted">Manage users, roles and categories. Only admins can see this page.</p>
      <UsersSection />
      <CategoriesSection />
    </RoleGuard>
  );
}
