import type { ReactNode } from 'react';
import { ROLE_LABELS } from '../config';
import { useCurrentUser } from '../session/CurrentUser';
import type { UserRole } from '../types';

export function RoleGuard({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user } = useCurrentUser();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return (
      <section className="card notice" role="alert">
        <h1>Access denied</h1>
        <p>
          This page is only available for: {roles.map((r) => ROLE_LABELS[r]).join(', ')}. You are signed in as{' '}
          {user.display_name} ({ROLE_LABELS[user.role]}).
        </p>
      </section>
    );
  }
  return <>{children}</>;
}
