import { useState } from "react";
import { UserPlus, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Branch } from "@/contexts/BranchContext";

interface InviteUserDialogProps {
  branches: Branch[];
  inviterName?: string;
}

export function InviteUserDialog({ branches, inviterName }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("staff");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  function toggleBranch(branchId: string) {
    setSelectedBranches(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  }

  async function handleSendInvite() {
    if (!email) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }

    if (selectedRole !== "admin" && selectedBranches.length === 0) {
      toast({ 
        title: "Please select at least one branch", 
        description: "Non-admin users need branch access to work in the system.",
        variant: "destructive" 
      });
      return;
    }

    setSending(true);

    try {
      const branchNames = selectedBranches
        .map(id => branches.find(b => b.id === id)?.name)
        .filter(Boolean) as string[];

      const signupUrl = `${window.location.origin}/auth`;

      const { data, error } = await supabase.functions.invoke("send-user-invite", {
        body: {
          email,
          role: selectedRole,
          branchNames,
          inviterName: inviterName || "An administrator",
          signupUrl,
        },
      });

      if (error) throw error;

      toast({ 
        title: "Invitation sent!", 
        description: `An invitation email has been sent to ${email}` 
      });
      
      setOpen(false);
      setEmail("");
      setSelectedRole("staff");
      setSelectedBranches([]);
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Failed to send invitation",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="admin">Admin - Full access to all features</SelectItem>
                <SelectItem value="staff">Staff - Access to assigned branches</SelectItem>
                <SelectItem value="cashier">Cashier - POS access only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Branch Selection */}
          {selectedRole !== "admin" && (
            <div className="space-y-3">
              <Label>Branch Access</Label>
              <div className="border rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto">
                {branches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No branches available</p>
                ) : (
                  branches.map(branch => (
                    <div key={branch.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`invite-branch-${branch.id}`}
                        checked={selectedBranches.includes(branch.id)}
                        onCheckedChange={() => toggleBranch(branch.id)}
                      />
                      <label
                        htmlFor={`invite-branch-${branch.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {branch.name}
                        <span className="text-muted-foreground ml-2">({branch.code})</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedBranches.length === 0 && (
                <p className="text-sm text-orange-600">
                  ⚠️ Please select at least one branch for the user
                </p>
              )}
            </div>
          )}

          {selectedRole === "admin" && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              ℹ️ Admins automatically have access to all branches
            </p>
          )}

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              The user will receive an email with a link to create their account. 
              Once they sign up, they'll automatically have the role and branch access you've configured here.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
