import { describe, expect, it } from 'vitest';
import { loginErrorMessage, readAuthErrorFromUrl, RESTRICTED_MESSAGE, safeNextPath } from './authMessages';

describe('loginErrorMessage', () => {
  it('shows one generic message for wrong email or password', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Email or password is incorrect.',
    );
    expect(loginErrorMessage({ message: 'Invalid login credentials' })).toBe('Email or password is incorrect.');
  });
  it('explains deactivated accounts', () => {
    expect(loginErrorMessage({ code: 'user_banned' })).toMatch(/deactivated/);
  });
  it('falls back to a general message', () => {
    expect(loginErrorMessage({ message: 'Network down' })).toBe('Sign-in failed. Please try again.');
    expect(loginErrorMessage(null)).toBeNull();
  });
});

describe('readAuthErrorFromUrl', () => {
  it('detects the allowlist rejection after a Google sign-in', () => {
    expect(
      readAuthErrorFromUrl('?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user', ''),
    ).toBe(RESTRICTED_MESSAGE);
    expect(readAuthErrorFromUrl('', '#error=server_error&error_description=Database%20error%20saving%20new%20user')).toBe(
      RESTRICTED_MESSAGE,
    );
  });
  it('detects a cancelled Google sign-in', () => {
    expect(readAuthErrorFromUrl('?error=access_denied', '')).toBe('Google sign-in was cancelled.');
  });
  it('returns null without an error', () => {
    expect(readAuthErrorFromUrl('?next=/admin', '')).toBeNull();
  });
});

describe('safeNextPath', () => {
  it('keeps pages inside the app', () => {
    expect(safeNextPath('/admin')).toBe('/admin');
    expect(safeNextPath('/dashboard?sort=votes')).toBe('/dashboard?sort=votes');
  });
  it('rejects external, empty and login targets', () => {
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('//evil.example')).toBe('/dashboard');
    expect(safeNextPath('/login')).toBe('/dashboard');
    expect(safeNextPath(null)).toBe('/dashboard');
  });
});
