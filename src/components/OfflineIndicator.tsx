import { Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOfflineSyncContext } from '@/contexts/OfflineSyncContext';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { online, syncing, pendingCount, sync } = useOfflineSyncContext();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Pending changes badge */}
        {pendingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1">
                <CloudOff className="w-3 h-3" />
                {pendingCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{pendingCount} pending change{pendingCount > 1 ? 's' : ''} to sync</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Online/Offline status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Badge 
                variant="outline" 
                className={cn(
                  "gap-1",
                  online 
                    ? "border-primary/50 text-primary" 
                    : "border-destructive/50 text-destructive"
                )}
              >
                {online ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </>
                )}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{online ? 'Connected to internet' : 'Working offline - changes will sync when reconnected'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Sync button */}
        {online && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={sync}
                disabled={syncing}
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{syncing ? 'Syncing...' : 'Sync now'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
