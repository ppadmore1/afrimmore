import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  Mail, 
  Clock, 
  RefreshCw, 
  X, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Branch } from "@/contexts/BranchContext";

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'staff' | 'cashier';
  branch_ids: string[];
  status: string;
  created_at: string;
  expires_at: string;
  resent_count: number;
  resent_at: string | null;
}

interface PendingInvitationsProps {
  branches: Branch[];
  inviterName?: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  staff: { label: "Staff", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  cashier: { label: "Cashier", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  accepted: { label: "Accepted", icon: CheckCircle2, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  expired: { label: "Expired", icon: AlertCircle, color: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", icon: X, color: "bg-muted text-muted-foreground" },
};

export function PendingInvitations({ branches, inviterName }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [invitationToCancel, setInvitationToCancel] = useState<Invitation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations((data as Invitation[]) || []);
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(invitation: Invitation) {
    setResending(invitation.id);

    try {
      const branchNames = invitation.branch_ids
        .map(id => branches.find(b => b.id === id)?.name)
        .filter(Boolean) as string[];

      const signupUrl = `${window.location.origin}/auth`;

      const { error: sendError } = await supabase.functions.invoke("send-user-invite", {
        body: {
          email: invitation.email,
          role: invitation.role,
          branchNames,
          inviterName: inviterName || "An administrator",
          signupUrl,
        },
      });

      if (sendError) throw sendError;

      // Update resent count and timestamp
      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          resent_at: new Date().toISOString(),
          resent_count: invitation.resent_count + 1,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      toast({ title: "Invitation resent!", description: `Email sent to ${invitation.email}` });
      loadInvitations();
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      toast({
        title: "Failed to resend invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(null);
    }
  }

  function openCancelDialog(invitation: Invitation) {
    setInvitationToCancel(invitation);
    setCancelDialogOpen(true);
  }

  async function handleCancel() {
    if (!invitationToCancel) return;

    setCancelling(true);

    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationToCancel.id);

      if (error) throw error;

      toast({ title: "Invitation cancelled" });
      setCancelDialogOpen(false);
      setInvitationToCancel(null);
      loadInvitations();
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      toast({
        title: "Failed to cancel invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }

  function isExpired(expiresAt: string) {
    return new Date(expiresAt) < new Date();
  }

  const pendingCount = invitations.filter(i => i.status === 'pending' && !isExpired(i.expires_at)).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg">
                    Pending Invitations
                    {pendingCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {pendingCount}
                      </Badge>
                    )}
                  </CardTitle>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {invitations.map(invitation => {
                  const expired = isExpired(invitation.expires_at);
                  const effectiveStatus = invitation.status === 'pending' && expired ? 'expired' : invitation.status;
                  const status = statusConfig[effectiveStatus];
                  const StatusIcon = status.icon;
                  
                  return (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-card"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {invitation.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{invitation.email}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={roleLabels[invitation.role]?.color}>
                              {roleLabels[invitation.role]?.label}
                            </Badge>
                            <Badge variant="outline" className={status.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                            </span>
                            {invitation.resent_count > 0 && (
                              <span className="text-xs text-muted-foreground">
                                • Resent {invitation.resent_count}x
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {invitation.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResend(invitation)}
                            disabled={resending === invitation.id}
                          >
                            {resending === invitation.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Resend
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCancelDialog(invitation)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation for{" "}
              <span className="font-semibold">{invitationToCancel?.email}</span>?
              They will no longer be able to use the invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Invitation</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Invitation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
