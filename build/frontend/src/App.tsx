import { useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { OFFICE_LABELS, ROLE_LABELS } from './config';
import { repository } from './data';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { SubmitIdeaPage } from './pages/SubmitIdeaPage';
import { useCurrentUser } from './session/CurrentUser';

function Header() {
  const { user, users, actAs } = useCurrentUser();
  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/dashboard" className="brand">
          <span className="brand-mark" aria-hidden="true">
            T&amp;R
          </span>
          <span className="brand-text">
            <span className="brand-company">Tallis &amp; Reeve</span>
            <span className="brand-app">IdeaForge</span>
          </span>
        </NavLink>

        <nav className="main-nav" aria-label="Main">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/submit">Submit an idea</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="acting-as">
          <label htmlFor="acting-as">Acting as</label>
          <select id="acting-as" value={user?.user_id ?? ''} onChange={(e) => actAs(Number(e.target.value))}>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name} · {ROLE_LABELS[u.role]} · {OFFICE_LABELS[u.office]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { refreshUsers } = useCurrentUser();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  async function reset() {
    if (!window.confirm('Reset all demo data? Ideas, votes and changes you made will be lost.')) return;
    setResetting(true);
    await repository.resetDemoData();
    await refreshUsers();
    setResetting(false);
    navigate('/dashboard', { replace: true });
    window.location.reload();
  }

  return (
    <footer className="site-footer">
      <p>Prototype with demo data. Everything you change is stored in this browser only.</p>
      <button type="button" className="btn btn-secondary btn-small" onClick={() => void reset()} disabled={resetting}>
        Reset demo data
      </button>
    </footer>
  );
}

export function App() {
  const { user } = useCurrentUser();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="container">
        {user ? (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/submit" element={<SubmitIdeaPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </main>
      <Footer />
    </>
  );
}
