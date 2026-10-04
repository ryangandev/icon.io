import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../net/session';

/**
 * Pages that seat a player need their name first: without one, the name page
 * asks for it and then comes back here.
 */
export function RequireName() {
  const { name } = useSession();
  const location = useLocation();
  if (name) return <Outlet />;
  const next = location.pathname + location.search;
  return <Navigate to={`/name?next=${encodeURIComponent(next)}`} replace />;
}
