// The signed-in user (US-0). Two modes, chosen with VITE_AUTH_SOURCE:
// * mock (default): simulated login with the "Acting as" switcher (US-5: "The user can be simulated for tests")
// * supabase: real login with Google or email/password via Supabase Auth; the own app_user row
//   is loaded from Supabase and matched to the mock data by email (see lib/sessionUser.ts)
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { repository } from '../data';
import { syncMockUser } from '../data/mockRepository';
import { getSupabaseClient } from '../data/supabaseClient';
import type { SessionProfile } from '../lib/sessionUser';
import type { AppUser } from '../types';

export type AuthMode = 'mock' | 'supabase';
export const AUTH_MODE: AuthMode = import.meta.env.VITE_AUTH_SOURCE === 'supabase' ? 'supabase' : 'mock';

/** loading: session not known yet; signedOut: login page; signedIn: user is set. */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

const STORAGE_KEY = 'ideaforge-prototype-current-user';
const DEFAULT_USER_ID = 5; // Daniel Okafor, Staff

interface CurrentUserContextValue {
  authMode: AuthMode;
  status: AuthStatus;
  user: AppUser | null;
  users: AppUser[];
  /** Mock mode only: switch the simulated user. */
  actAs: (userId: number) => void;
  /** Reload users after role changes or a data reset. */
  refreshUsers: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Why the user was signed out again (e.g. deactivated account); shown on the login page. */
  notice: string | null;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function readStoredUserId(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

function MockUserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userId, setUserId] = useState<number>(readStoredUserId);

  const refreshUsers = useCallback(async () => {
    setUsers(await repository.listUsers());
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const actAs = useCallback((id: number) => {
    setUserId(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // Not remembered across reloads, but still works for this session.
    }
  }, []);

  const user = users.find((u) => u.user_id === userId) ?? users.find((u) => u.user_id === DEFAULT_USER_ID) ?? null;

  return (
    <CurrentUserContext.Provider
      value={{
        authMode: 'mock',
        status: user ? 'signedIn' : 'loading',
        user,
        users,
        actAs,
        refreshUsers,
        signOut: async () => {},
        notice: null,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

function SupabaseUserProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    setUsers(await repository.listUsers());
  }, []);

  // Only store the session here; loading the profile happens in the effect below
  // (Supabase recommends not to call other Supabase functions inside onAuthStateChange).
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const authUserId = session?.user.id;
  useEffect(() => {
    if (!authUserId) {
      setUser(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('app_user')
        .select('email, display_name, office, role, is_active')
        .eq('auth_user_id', authUserId)
        .maybeSingle<SessionProfile>();
      if (cancelled) return;
      if (error || !data || !data.is_active) {
        setNotice(
          data && !data.is_active
            ? 'Your account has been deactivated. Please contact an admin.'
            : 'Your user profile could not be loaded. Please try again or contact an admin.',
        );
        await supabase.auth.signOut();
        return;
      }
      setNotice(null);
      setUser(syncMockUser(data));
      await refreshUsers();
    })();
    return () => {
      cancelled = true;
    };
  }, [authUserId, supabase, refreshUsers]);

  const signOut = useCallback(async () => {
    setNotice(null);
    await supabase.auth.signOut();
  }, [supabase]);

  const status: AuthStatus = session === undefined || (session && !user) ? 'loading' : session ? 'signedIn' : 'signedOut';

  return (
    <CurrentUserContext.Provider
      value={{ authMode: 'supabase', status, user, users, actAs: () => {}, refreshUsers, signOut, notice }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  return AUTH_MODE === 'supabase' ? (
    <SupabaseUserProvider>{children}</SupabaseUserProvider>
  ) : (
    <MockUserProvider>{children}</MockUserProvider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return value;
}
