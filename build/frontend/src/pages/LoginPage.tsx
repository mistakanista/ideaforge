// Login page (US-0): sign in with Google or with email and password via Supabase Auth.
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { getSupabaseClient } from '../data/supabaseClient';
import { loginErrorMessage, readAuthErrorFromUrl, safeNextPath } from '../lib/authMessages';
import { useCurrentUser } from '../session/CurrentUser';

// Read before the Supabase client processes (and removes) the redirect parameters.
const initialUrlError = readAuthErrorFromUrl(window.location.search, window.location.hash);

export function LoginPage() {
  const { status, notice } = useCurrentUser();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;
  const next = safeNextPath(from ?? params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialUrlError);
  const [busy, setBusy] = useState(false);

  if (status === 'signedIn') return <Navigate to={next} replace />;

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(loginErrorMessage(signInError));
  }

  async function signInWithGoogle() {
    setError(null);
    const { error: oauthError } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}` },
    });
    if (oauthError) setError('Google sign-in could not be started. Please try again.');
  }

  const message = error ?? notice;

  return (
    <section className="login" aria-labelledby="login-heading">
      <div className="card login-card">
        <h1 id="login-heading">Sign in to IdeaForge</h1>
        <p className="muted">The idea pipeline of Tallis &amp; Reeve. Please sign in with your work account.</p>

        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}

        <button type="button" className="btn btn-primary btn-block" onClick={() => void signInWithGoogle()}>
          Sign in with Google
        </button>

        <div className="login-divider" role="separator">
          <span>or with email and password</span>
        </div>

        <form onSubmit={signInWithPassword} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="firstname.lastname@tallis.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}
