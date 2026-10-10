import { describe, expect, it } from 'vitest';
import { passwordChangeErrorMessage, validateNewPassword } from './passwordRules';

describe('validateNewPassword', () => {
  it('accepts a long enough password that is confirmed', () => {
    expect(validateNewPassword('Ideas4ever!', 'Ideas4ever!')).toEqual({});
  });
  it('requires both fields', () => {
    expect(validateNewPassword('', '')).toEqual({
      password: 'Please enter a new password.',
      confirm: 'Please enter the new password again.',
    });
  });
  it('requires at least 8 characters', () => {
    expect(validateNewPassword('short', 'short').password).toBe('Please use at least 8 characters.');
  });
  it('rejects the initial password', () => {
    expect(validateNewPassword('tallis123', 'tallis123').password).toMatch(/different from the initial password/);
  });
  it('requires the confirmation to match', () => {
    expect(validateNewPassword('Ideas4ever!', 'Ideas4ever?').confirm).toBe('The two passwords do not match.');
  });
});

describe('passwordChangeErrorMessage', () => {
  it('explains Supabase errors', () => {
    expect(passwordChangeErrorMessage({ code: 'same_password' })).toMatch(/different from your current one/);
    expect(passwordChangeErrorMessage({ code: 'weak_password' })).toMatch(/too weak/);
    expect(passwordChangeErrorMessage({ message: 'boom' })).toMatch(/could not be changed/);
  });
});
