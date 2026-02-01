import { createContext, useContext, ReactNode } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface OfflineSyncContextType {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  sync: () => Promise<void>;
  updatePendingCount: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const offlineSync = useOfflineSync();

  return (
    <OfflineSyncContext.Provider value={offlineSync}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (context === undefined) {
    throw new Error('useOfflineSyncContext must be used within an OfflineSyncProvider');
  }
  return context;
}
