import { describe, expect, it } from 'vitest';
import type { AppUser } from '../types';
import { upsertUserByEmail } from './sessionUser';

const daniel: AppUser = {
  user_id: 5,
  email: 'daniel.okafor@tallis.uk',
  display_name: 'Daniel Okafor',
  office: 'BRISTOL',
  role: 'STAFF',
  role_changed_by: null,
  role_changed_at: null,
  is_active: true,
};
const priya: AppUser = { ...daniel, user_id: 1, email: 'priya.shah@tallis.uk', display_name: 'Priya Shah', role: 'ADMIN' };

describe('upsertUserByEmail', () => {
  it('matches an existing mock user by email (ignoring case) and keeps its id', () => {
    const result = upsertUserByEmail([priya, daniel], {
      email: 'Daniel.Okafor@tallis.uk',
      display_name: 'Daniel Okafor',
      office: 'LEEDS',
      role: 'REVIEWER',
      is_active: true,
    });
    expect(result.user.user_id).toBe(5);
    expect(result.users).toHaveLength(2);
  });
  it('takes role, office and name from Supabase', () => {
    const { user } = upsertUserByEmail([priya, daniel], {
      email: 'priya.shah@tallis.uk',
      display_name: 'Priya S.',
      office: 'GLASGOW',
      role: 'STAFF',
      is_active: true,
    });
    expect([user.role, user.office, user.display_name]).toEqual(['STAFF', 'GLASGOW', 'Priya S.']);
  });
  it('keeps the mock office while the Supabase office is still empty', () => {
    const { user } = upsertUserByEmail([daniel], { ...daniel, office: null });
    expect(user.office).toBe('BRISTOL');
  });
  it('adds users that are not in the mock data with a new id', () => {
    const result = upsertUserByEmail([priya, daniel], {
      email: 'dev.colleague@gmail.com',
      display_name: 'Dev Colleague',
      office: null,
      role: 'STAFF',
      is_active: true,
    });
    expect(result.user.user_id).toBe(6);
    expect(result.users).toHaveLength(3);
  });
});
