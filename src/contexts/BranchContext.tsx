import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BranchContextType {
  branches: Branch[];
  userBranches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch | null) => void;
  isAdmin: boolean;
  loading: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const setCurrentBranch = (branch: Branch | null) => {
    setCurrentBranchState(branch);
    if (branch) {
      localStorage.setItem('currentBranchId', branch.id);
    } else {
      localStorage.removeItem('currentBranchId');
    }
  };

  const refreshBranches = async () => {
    if (!user) {
      setBranches([]);
      setUserBranches([]);
      setCurrentBranchState(null);
      setLoading(false);
      return;
    }

    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const userIsAdmin = roleData?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // Get all branches
      const { data: allBranches, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (branchesError) throw branchesError;
      setBranches(allBranches || []);

      // Get user's assigned branches
      const { data: userBranchAssignments, error: assignmentsError } = await supabase
        .from('user_branches')
        .select('branch_id, is_default, branches(*)')
        .eq('user_id', user.id);

      if (assignmentsError) throw assignmentsError;

      const userBranchList = userBranchAssignments
        ?.map(ub => ub.branches as unknown as Branch)
        .filter(Boolean) || [];

      // For admins, they can access all branches
      const accessibleBranches = userIsAdmin ? (allBranches || []) : userBranchList;
      setUserBranches(accessibleBranches);

      // Restore current branch from localStorage or use default
      const savedBranchId = localStorage.getItem('currentBranchId');
      const savedBranch = accessibleBranches.find(b => b.id === savedBranchId);
      
      if (savedBranch) {
        setCurrentBranchState(savedBranch);
      } else if (accessibleBranches.length > 0) {
        // Find default branch or use first
        const defaultAssignment = userBranchAssignments?.find(ub => ub.is_default);
        const defaultBranch = defaultAssignment 
          ? accessibleBranches.find(b => b.id === defaultAssignment.branch_id)
          : accessibleBranches[0];
        setCurrentBranchState(defaultBranch || accessibleBranches[0]);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBranches();
  }, [user]);

  return (
    <BranchContext.Provider value={{
      branches,
      userBranches,
      currentBranch,
      setCurrentBranch,
      isAdmin,
      loading,
      refreshBranches,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
