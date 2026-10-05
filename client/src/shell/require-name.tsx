import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../net/session';

/** The name page, set to continue to `next` once the player has a name. */
export function namePath(next: string): string {
  return `/name?next=${encodeURIComponent(next)}`;
}

/**
 * Pages that seat a player need their name first: without one, the name page
 * asks for it and then comes back here.
 */
export function RequireName() {
  const { name } = useSession();
  const location = useLocation();
  if (name) return <Outlet />;
  return (
    <Navigate to={namePath(location.pathname + location.search)} replace />
  );
}
