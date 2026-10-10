// First-login page (US-0 step 4): users with an initial password must set their own password.
// The password goes directly to Supabase Auth; the database trigger on_auth_password_changed
// then clears app_user.must_change_password.
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSupabaseClient } from '../data/supabaseClient';
import { safeNextPath } from '../lib/authMessages';
import { MIN_PASSWORD_LENGTH, passwordChangeErrorMessage, validateNewPassword, type PasswordErrors } from '../lib/passwordRules';
import { useCurrentUser } from '../session/CurrentUser';

export function FirstLoginPage() {
  const { user, mustChangePassword, reloadProfile, signOut } = useCurrentUser();
  const location = useLocation();
  const next = safeNextPath((location.state as { from?: string } | null)?.from);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!mustChangePassword) return <Navigate to={next} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateNewPassword(password, confirm);
    setErrors(found);
    setFormError(null);
    if (found.password || found.confirm) return;

    setSaving(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    if (error) {
      setFormError(passwordChangeErrorMessage(error));
      setSaving(false);
      return;
    }
    // must_change_password is now false in the database; loading the profile again lets the guard continue.
    await reloadProfile();
  }

  return (
    <section className="login" aria-labelledby="welcome-heading">
      <div className="card login-card">
        <h1 id="welcome-heading">Set your new password</h1>
        <p className="muted">
          Welcome{user ? `, ${user.display_name}` : ''}! You signed in with an initial password. Please choose your own
          password before you continue.
        </p>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'new-password-error' : 'new-password-hint'}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: undefined }));
              }}
            />
            <p id="new-password-hint" className="hint">
              At least {MIN_PASSWORD_LENGTH} characters, different from the initial password.
            </p>
            {errors.password && (
              <p id="new-password-error" className="field-error">
                {errors.password}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={errors.confirm ? true : undefined}
              aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((prev) => ({ ...prev, confirm: undefined }));
              }}
            />
            {errors.confirm && (
              <p id="confirm-password-error" className="field-error">
                {errors.confirm}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? 'Saving…' : 'Save password and continue'}
          </button>
        </form>

        <p className="login-footnote">
          Not you?{' '}
          <button type="button" className="link-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </p>
      </div>
    </section>
  );
}
