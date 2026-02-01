import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Smartphone, Monitor, CheckCircle2, Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useOfflineSyncContext } from '@/contexts/OfflineSyncContext';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const { online, syncing, pendingCount, sync } = useOfflineSyncContext();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Install AfrimMore</h1>
          <p className="text-muted-foreground">
            Install the app on your device for offline access and a native experience
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {online ? (
                  <Wifi className="w-8 h-8 text-primary" />
                ) : (
                  <WifiOff className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <p className="font-medium">{online ? 'Online' : 'Offline'}</p>
                  <p className="text-sm text-muted-foreground">
                    {online ? 'Connected to internet' : 'Working offline'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {isInstalled ? (
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                ) : (
                  <Download className="w-8 h-8 text-primary" />
                )}
                <div>
                  <p className="font-medium">{isInstalled ? 'Installed' : 'Not Installed'}</p>
                  <p className="text-sm text-muted-foreground">
                    {isInstalled ? 'App is ready' : 'Install for offline use'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Changes */}
        {pendingCount > 0 && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CloudOff className="w-6 h-6 text-destructive" />
                  <div>
                    <p className="font-medium">Pending Changes</p>
                    <p className="text-sm text-muted-foreground">
                      {pendingCount} change{pendingCount > 1 ? 's' : ''} waiting to sync
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">{pendingCount}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Install Instructions */}
        {!isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Install the App
              </CardTitle>
              <CardDescription>
                Get quick access and work offline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deferredPrompt ? (
                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Install AfrimMore
                </Button>
              ) : isIOS ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      iOS Installation Steps:
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Tap the Share button in Safari</li>
                      <li>Scroll down and tap "Add to Home Screen"</li>
                      <li>Tap "Add" to confirm</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Desktop Installation:
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Look for the install icon in your browser's address bar</li>
                      <li>Click it and select "Install"</li>
                      <li>Or use browser menu → Install App</li>
                    </ol>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Android Installation:
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Tap the browser menu (three dots)</li>
                      <li>Select "Install app" or "Add to Home screen"</li>
                      <li>Follow the prompts to install</li>
                    </ol>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Offline Features</CardTitle>
            <CardDescription>
              What you can do without internet connection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                'View previously loaded documents',
                'Create new invoices, quotations, and receipts',
                'Access product catalog and customer list',
                'Generate and print PDFs',
                'Automatic sync when back online',
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-5 h-5 ${online ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium">Auto-Sync</p>
                  <p className="text-sm text-muted-foreground">
                    {online 
                      ? 'Data syncs automatically when connected' 
                      : 'Changes will sync when you reconnect'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!online || syncing}
                onClick={sync}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
