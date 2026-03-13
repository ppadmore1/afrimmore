import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  is_active: boolean;
  plan: string;
  max_users: number;
  max_branches: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
}

interface TenantContextType {
  tenant: Tenant | null;
  subscription: TenantSubscription | null;
  loading: boolean;
  isTrialExpired: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTenant = async () => {
    if (!user) {
      setTenant(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      // Get user's tenant via tenant_users
      const { data: tenantUser, error: tuError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tuError || !tenantUser) {
        setLoading(false);
        return;
      }

      // Get tenant details
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantUser.tenant_id)
        .maybeSingle();

      if (tenantData) {
        setTenant(tenantData as Tenant);
      }

      // Get subscription
      const { data: subData } = await supabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantUser.tenant_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubscription(subData as TenantSubscription);
      }
    } catch (error) {
      console.error('Error loading tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTenant();
  }, [user]);

  const isTrialExpired = subscription?.status === 'trial' && 
    subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) < new Date() : false;

  return (
    <TenantContext.Provider value={{ tenant, subscription, loading, isTrialExpired, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
