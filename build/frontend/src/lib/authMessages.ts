// User-facing messages for sign-in problems (US-0). Pure functions, unit tested.

export const RESTRICTED_MESSAGE = 'Access is restricted to Tallis & Reeve staff.';

/** Message for a failed email/password sign-in. Never reveals whether the email exists. */
export function loginErrorMessage(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code === 'user_banned') return 'Your account has been deactivated. Please contact an admin.';
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) {
    return 'Email or password is incorrect.';
  }
  return 'Sign-in failed. Please try again.';
}

/**
 * Supabase reports OAuth problems (e.g. a Google account that is not on the allowlist)
 * as query or hash parameters when it redirects back to the app.
 */
export function readAuthErrorFromUrl(search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const error = params.get('error') ?? hashParams.get('error');
  if (!error) return null;
  const description = params.get('error_description') ?? hashParams.get('error_description') ?? '';
  const code = params.get('error_code') ?? hashParams.get('error_code') ?? '';
  // handle_new_user() rejects emails that are not on login_allowlist; GoTrue reports it as a database error.
  if (/database error saving new user|restricted to tallis/i.test(description)) return RESTRICTED_MESSAGE;
  if (code === 'user_banned') return 'Your account has been deactivated. Please contact an admin.';
  if (error === 'access_denied') return 'Google sign-in was cancelled.';
  return 'Sign-in failed. Please try again.';
}

/** Only allow redirects to pages inside the app after sign-in. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return '/dashboard';
  return next;
}
