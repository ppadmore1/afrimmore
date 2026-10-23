import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Loader2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { canAccessPath } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Pages still reachable after a trial expires, so the owner can pay or manage their account
const TRIAL_EXPIRED_ALLOWED = ['/subscription', '/profile', '/super-admin'];

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isTrialExpired, subscription } = useTenant();
  const location = useLocation();
  const userRole = useUserRole();

  if (loading || (user && userRole.loading)) {
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

  if (!canAccessPath(location.pathname, userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">You don't have access to this page</h1>
          <p className="text-sm text-muted-foreground">Your role doesn't include this page. Ask your admin if you need it.</p>
          <Button asChild><Link to="/">Go to Dashboard</Link></Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
