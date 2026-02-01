import { useState, useEffect, useCallback } from 'react';
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

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await getPendingOperationsCount();
    setPendingCount(count);
  }, []);

  // Sync data
  const sync = useCallback(async () => {
    if (!isOnline() || syncing) return;

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
      setSyncing(false);
    }
  }, [syncing, updatePendingCount]);

  // Handle online/offline events
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

    // Initial sync on mount
    if (isOnline()) {
      sync();
    }
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sync, updatePendingCount]);

  // Periodic sync when online
  useEffect(() => {
    if (!online) return;

    const interval = setInterval(() => {
      updatePendingCount();
      // Auto-sync every 5 minutes
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
