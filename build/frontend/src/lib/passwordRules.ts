// Rules for the new password on the first-login page (US-0 step 4). Pure functions, unit tested.

export const MIN_PASSWORD_LENGTH = 8;

/** Initial password of the imported dummy users (requirements/UserStories/0-Login.md). */
const INITIAL_PASSWORD = 'tallis123';

export interface PasswordErrors {
  password?: string;
  confirm?: string;
}

export function validateNewPassword(password: string, confirm: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!password) errors.password = 'Please enter a new password.';
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Please use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password === INITIAL_PASSWORD) {
    errors.password = 'Please choose a password that is different from the initial password.';
  }
  if (!confirm) errors.confirm = 'Please enter the new password again.';
  else if (password && confirm !== password) errors.confirm = 'The two passwords do not match.';
  return errors;
}

/** Message for an error returned by supabase.auth.updateUser({ password }). */
export function passwordChangeErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === 'same_password') return 'Please choose a password that is different from your current one.';
  if (error.code === 'weak_password') return 'This password is too weak. Please choose a longer one.';
  return 'Your password could not be changed. Please try again.';
}
