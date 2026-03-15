import { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

interface PlanLimits {
  maxUsers: number;
  maxBranches: number;
  maxProducts: number | null;
  currentUsers: number;
  currentBranches: number;
  currentProducts: number;
  canAddUser: boolean;
  canAddBranch: boolean;
  canAddProduct: boolean;
  loading: boolean;
  planName: string;
}

export function usePlanLimits(): PlanLimits {
  const { tenant, subscription } = useTenant();
  const [limits, setLimits] = useState<PlanLimits>({
    maxUsers: 2, maxBranches: 1, maxProducts: 100,
    currentUsers: 0, currentBranches: 0, currentProducts: 0,
    canAddUser: true, canAddBranch: true, canAddProduct: true,
    loading: true, planName: 'Starter',
  });

  useEffect(() => {
    if (!tenant) return;

    const load = async () => {
      // Get plan limits
      let maxProducts: number | null = 100;
      if (subscription?.plan_id) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('max_products, name')
          .eq('id', subscription.plan_id)
          .maybeSingle();
        if (plan) {
          maxProducts = plan.max_products;
        }
      }

      const [usersRes, branchesRes, productsRes] = await Promise.all([
        supabase.from('tenant_users').select('id').eq('tenant_id', tenant.id),
        supabase.from('branches').select('id').eq('tenant_id', tenant.id),
        supabase.from('products').select('id').eq('tenant_id', tenant.id).eq('is_active', true),
      ]);

      const currentUsers = usersRes.data?.length || 0;
      const currentBranches = branchesRes.data?.length || 0;
      const currentProducts = productsRes.data?.length || 0;

      setLimits({
        maxUsers: tenant.max_users,
        maxBranches: tenant.max_branches,
        maxProducts,
        currentUsers,
        currentBranches,
        currentProducts,
        canAddUser: currentUsers < tenant.max_users,
        canAddBranch: currentBranches < tenant.max_branches,
        canAddProduct: maxProducts === null || currentProducts < maxProducts,
        loading: false,
        planName: tenant.plan,
      });
    };

    load();
  }, [tenant, subscription]);

  return limits;
}
