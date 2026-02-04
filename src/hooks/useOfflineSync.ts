import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  isOnline, 
  syncFromServer, 
  syncPendingOperations, 
  getPendingOperationsCount 
} from '@/lib/offline-sync';
import { toast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const initialSyncDone = useRef(false);
  const syncingRef = useRef(false);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await getPendingOperationsCount();
    setPendingCount(count);
  }, []);

  // Sync data - use ref to prevent re-render loops
  const sync = useCallback(async () => {
    if (!isOnline() || syncingRef.current) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      // First, push pending changes to server
      const { success, failed } = await syncPendingOperations();
      if (success > 0) {
        toast({
          title: 'Sync complete',
          description: `${success} pending change${success > 1 ? 's' : ''} synced to server`,
        });
      }
      if (failed > 0) {
        toast({
          title: 'Some changes failed to sync',
          description: `${failed} change${failed > 1 ? 's' : ''} will be retried later`,
          variant: 'destructive',
        });
      }

      // Then pull latest from server
      await syncFromServer();
      await updatePendingCount();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [updatePendingCount]);

  // Handle online/offline events - run once on mount
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast({
        title: 'Back online',
        description: 'Syncing your changes...',
      });
      sync();
    };

    const handleOffline = () => {
      setOnline(false);
      toast({
        title: 'You are offline',
        description: 'Changes will be saved locally and synced when you reconnect',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync on mount - only once
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      if (isOnline()) {
        sync();
      }
      updatePendingCount();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sync, updatePendingCount]);

  // Periodic sync when online - every 5 minutes
  useEffect(() => {
    if (!online) return;

    const interval = setInterval(() => {
      updatePendingCount();
      // Auto-sync every 5 minutes if there are pending operations
      if (pendingCount > 0) {
        sync();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [online, pendingCount, sync, updatePendingCount]);

  return {
    online,
    syncing,
    pendingCount,
    sync,
    updatePendingCount,
  };
}
