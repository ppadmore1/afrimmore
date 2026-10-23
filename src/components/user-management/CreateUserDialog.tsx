import { useState } from "react";
import { UserPlus, Loader2, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Branch } from "@/contexts/BranchContext";

const ROLE_OPTIONS = [
  ["admin", "Admin - Full access"],
  ["branch_manager", "Branch Manager"],
  ["inventory_officer", "Inventory Officer"],
  ["accountant", "Accountant"],
  ["executive", "Executive"],
  ["staff", "Staff"],
  ["cashier", "Cashier - POS only"],
];

function genPassword() {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(a, (n) => c[n % c.length]).join("");
}

export function CreateUserDialog({ branches, onCreated }: { branches: Branch[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [role, setRole] = useState("cashier");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);

  function reset() {
    setFullName(""); setEmail(""); setPassword(genPassword()); setRole("cashier"); setBranchIds([]); setDone(null);
  }

  async function submit() {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tenant-user", {
        body: { email, password, fullName, role, branchIds: role === "admin" ? [] : branchIds },
      });
      let msg = (data as any)?.error;
      if (error && !msg) {
        try { msg = (await (error as any).context?.json())?.error; } catch { /* ignore */ }
        msg = msg || error.message;
      }
      if (msg) throw new Error(msg);
      setDone({ email: email.trim().toLowerCase(), password });
      toast({ title: "User created", description: "They can sign in right away." });
      onCreated();
    } catch (e: any) {
      toast({ title: "Could not create user", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><UserPlus className="w-4 h-4 mr-2" />Create User</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{done ? "User created" : "Create User Directly"}</DialogTitle></DialogHeader>
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Give these sign-in details to the user. Ask them to change the password after first sign-in.</p>
            <div className="rounded-lg border bg-muted/50 p-4 font-mono text-sm space-y-1">
              <div>Email: {done.email}</div>
              <div>Password: {done.password}</div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`Email: ${done.email}\nPassword: ${done.password}\nSign in: ${window.location.origin}/auth`); toast({ title: "Copied" }); }}>
                <Copy className="w-4 h-4 mr-2" />Copy
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" /></div>
            <div className="space-y-2">
              <Label>Temporary password</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(genPassword())}><RefreshCw className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {ROLE_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {role !== "admin" ? (
              <div className="space-y-2">
                <Label>Branch access</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-3 text-sm cursor-pointer">
                      <Checkbox checked={branchIds.includes(b.id)} onCheckedChange={() => setBranchIds((p) => p.includes(b.id) ? p.filter((x) => x !== b.id) : [...p, b.id])} />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">Admins have access to all branches.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !email || password.length < 8 || (role !== "admin" && branchIds.length === 0)}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}Create User
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
