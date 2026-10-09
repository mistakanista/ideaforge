// Simulated login (US-5: "The user can be simulated for tests"). Later replaced by Google login via Supabase Auth.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { repository } from '../data';
import type { AppUser } from '../types';

const STORAGE_KEY = 'ideaforge-prototype-current-user';
const DEFAULT_USER_ID = 5; // Daniel Okafor, Staff

interface CurrentUserContextValue {
  user: AppUser | null;
  users: AppUser[];
  actAs: (userId: number) => void;
  /** Reload users after role changes or a data reset. */
  refreshUsers: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function readStoredUserId(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
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
    <CurrentUserContext.Provider value={{ user, users, actAs, refreshUsers }}>{children}</CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return value;
}
