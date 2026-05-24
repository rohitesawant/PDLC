import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function AdminRoute() {
  const { state } = useAuth();
  if (state.status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-ink-500">
        Loading…
      </div>
    );
  }
  if (state.status !== 'authenticated' || !state.user.is_admin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
