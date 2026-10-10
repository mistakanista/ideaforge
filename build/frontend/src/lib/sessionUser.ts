// Interim glue for VITE_AUTH_SOURCE=supabase while the ideas still come from the mock data:
// the signed-in Supabase user is matched to the mock users by email. Name, role and office
// come from Supabase (source of truth); unknown users (e.g. allowlisted Google accounts) are added.
import type { AppUser, OfficeCode, UserRole } from '../types';

/** The fields of the own public.app_user row that the app needs after sign-in. */
export interface SessionProfile {
  email: string;
  display_name: string;
  office: OfficeCode | null;
  role: UserRole;
  is_active: boolean;
}

/** Office shown until the user chooses one (first-login page, US-0 step 4). */
const FALLBACK_OFFICE: OfficeCode = 'BRISTOL';

export function upsertUserByEmail(users: AppUser[], profile: SessionProfile): { users: AppUser[]; user: AppUser } {
  const email = profile.email.toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === email);
  const user: AppUser = {
    user_id: existing?.user_id ?? users.reduce((max, u) => Math.max(max, u.user_id), 0) + 1,
    email,
    display_name: profile.display_name,
    office: profile.office ?? existing?.office ?? FALLBACK_OFFICE,
    role: profile.role,
    role_changed_by: existing?.role_changed_by ?? null,
    role_changed_at: existing?.role_changed_at ?? null,
    is_active: profile.is_active,
  };
  return {
    users: existing ? users.map((u) => (u.user_id === user.user_id ? user : u)) : [...users, user],
    user,
  };
}
