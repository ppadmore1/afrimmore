import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Pages still reachable after a trial expires, so the owner can pay or manage their account
const TRIAL_EXPIRED_ALLOWED = ['/subscription', '/profile', '/super-admin'];

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isTrialExpired, subscription } = useTenant();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const blocked = isTrialExpired || ['expired', 'cancelled', 'suspended'].includes(subscription?.status ?? '');
  if (blocked && !TRIAL_EXPIRED_ALLOWED.includes(location.pathname)) {
    return <Navigate to="/subscription?expired=1" replace />;
  }

  return <>{children}</>;
}
