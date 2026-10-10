import { useState, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { OFFICE_LABELS, ROLE_LABELS } from './config';
import { repository } from './data';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { SubmitIdeaPage } from './pages/SubmitIdeaPage';
import { useCurrentUser } from './session/CurrentUser';

function Header() {
  const { authMode, status, user, users, actAs, signOut } = useCurrentUser();
  const signedIn = status === 'signedIn' && user;
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

        {signedIn && (
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/submit">Submit an idea</NavLink>
            {user.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
          </nav>
        )}

        {signedIn && authMode === 'mock' && (
          <div className="acting-as">
            <label htmlFor="acting-as">Acting as</label>
            <select id="acting-as" value={user.user_id} onChange={(e) => actAs(Number(e.target.value))}>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name} · {ROLE_LABELS[u.role]} · {OFFICE_LABELS[u.office]}
                </option>
              ))}
            </select>
          </div>
        )}

        {signedIn && authMode === 'supabase' && (
          <div className="signed-in">
            <span className="signed-in-name">
              {user.display_name}
              <span className="signed-in-role"> · {ROLE_LABELS[user.role]}</span>
            </span>
            <button type="button" className="btn btn-on-dark btn-small" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Footer() {
  const { status, refreshUsers } = useCurrentUser();
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
      {status === 'signedIn' && (
        <button type="button" className="btn btn-secondary btn-small" onClick={() => void reset()} disabled={resetting}>
          Reset demo data
        </button>
      )}
    </footer>
  );
}

/** Every page except /login requires a signed-in user; the requested page is opened after sign-in. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useCurrentUser();
  const location = useLocation();
  if (status === 'loading') return <p className="muted">Loading…</p>;
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

export function App() {
  const { authMode } = useCurrentUser();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="container">
        <Routes>
          <Route path="/login" element={authMode === 'supabase' ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/submit" element={<RequireAuth><SubmitIdeaPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
