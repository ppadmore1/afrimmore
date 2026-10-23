import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'staff' | 'cashier' | 'owner' | 'branch_manager' | 'inventory_officer' | 'accountant' | 'executive';

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner', admin: 'Administrator', executive: 'Executive', branch_manager: 'Branch Manager',
  accountant: 'Accountant', inventory_officer: 'Inventory Officer', staff: 'Staff', cashier: 'Cashier',
};
const ORDER: AppRole[] = ['owner','admin','executive','branch_manager','accountant','inventory_officer','staff','cashier'];
export const primaryRoleLabel = (roles: AppRole[]) => { const r = ORDER.find(o => roles.includes(o)); return r ? ROLE_LABELS[r] : 'User'; };

interface UserRoleState {
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isCashier: boolean;
}

export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    async function fetchRoles() {
      if (!user) {
        setRoles([]);
        setLoading(false);
        setLoadedFor(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        setRoles(data?.map(r => r.role as AppRole) || []);
      } catch (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
        setLoadedFor(user.id);
      }
    }

    fetchRoles();
  }, [user]);

  return {
    roles,
    loading: loading || loadedFor !== (user?.id ?? null),
    isAdmin: roles.includes('admin') || roles.includes('owner'),
    isStaff: ['staff','admin','owner','branch_manager','inventory_officer','accountant','executive'].some(r => roles.includes(r as AppRole)),
    isCashier: roles.length > 0,
  };
}
