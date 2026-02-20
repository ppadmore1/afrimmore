import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ShieldCheck, DollarSign } from "lucide-react";

interface ApprovalThreshold {
  id: string;
  action_type: string;
  label: string;
  min_amount: number;
  max_amount: number | null;
  approver_role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff / Any",
  cashier: "Cashier",
};

const ACTION_TYPES = ["purchase", "expense", "refund", "transfer"];

export default function ApprovalThresholdsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalThreshold | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    action_type: "purchase",
    label: "",
    min_amount: 0,
    max_amount: "",
    approver_role: "admin",
    is_active: true,
  });

  const { data: thresholds = [], isLoading } = useQuery({
    queryKey: ["approval-thresholds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_thresholds")
        .select("*")
        .order("action_type")
        .order("min_amount");
      if (error) throw error;
      return data as ApprovalThreshold[];
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ action_type: "purchase", label: "", min_amount: 0, max_amount: "", approver_role: "admin", is_active: true });
    setDialogOpen(true);
  }

  function openEdit(t: ApprovalThreshold) {
    setEditing(t);
    setForm({
      action_type: t.action_type,
      label: t.label,
      min_amount: t.min_amount,
      max_amount: t.max_amount !== null ? String(t.max_amount) : "",
      approver_role: t.approver_role,
      is_active: t.is_active,
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        action_type: form.action_type,
        label: form.label.trim(),
        min_amount: Number(form.min_amount),
        max_amount: form.max_amount !== "" ? Number(form.max_amount) : null,
        approver_role: form.approver_role,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("approval_thresholds").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("approval_thresholds").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-thresholds"] });
      toast({ title: editing ? "Threshold updated" : "Threshold added" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approval_thresholds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-thresholds"] });
      toast({ title: "Threshold deleted" });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grouped = thresholds.reduce((acc, t) => {
    if (!acc[t.action_type]) acc[t.action_type] = [];
    acc[t.action_type].push(t);
    return acc;
  }, {} as Record<string, ApprovalThreshold[]>);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Approval Thresholds</h1>
            <p className="text-muted-foreground mt-1">
              Configure who must approve purchases or expenses based on amount. Amounts are in your local currency.
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Threshold
          </Button>
        </div>

        {/* Summary */}
        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-4 pb-3 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">How approval thresholds work</p>
              <p className="text-xs text-muted-foreground mt-1">
                When a staff member attempts to make a purchase or expense, the system checks the amount against these thresholds and requires approval from the specified role before proceeding. Admins can approve anything.
              </p>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-1">No thresholds defined</h3>
              <p className="text-sm text-muted-foreground mb-4">Add your first approval threshold to control spending.</p>
              <Button onClick={openNew} variant="outline">Add Threshold</Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([type, items]) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="capitalize">{type} Approvals</CardTitle>
                <CardDescription>Rules governing approval requirements for {type} transactions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Amount Range</TableHead>
                      <TableHead>Approver Required</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.label}</TableCell>
                        <TableCell className="font-mono text-sm">
                          ${t.min_amount.toLocaleString()}
                          {t.max_amount !== null ? ` – $${t.max_amount.toLocaleString()}` : " and above"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {ROLE_LABELS[t.approver_role] || t.approver_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.is_active ? "default" : "secondary"}>
                            {t.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Threshold" : "Add Approval Threshold"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input
                placeholder="e.g. Small Purchase"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Action Type</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm((p) => ({ ...p, action_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => (
                    <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Amount ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_amount}
                  onChange={(e) => setForm((p) => ({ ...p, min_amount: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max Amount ($) <span className="text-muted-foreground text-xs">(blank = unlimited)</span></Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_amount}
                  onChange={(e) => setForm((p) => ({ ...p, max_amount: e.target.value }))}
                  placeholder="No limit"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Approver Role Required</Label>
              <Select value={form.approver_role} onValueChange={(v) => setForm((p) => ({ ...p, approver_role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff / Any (no approval needed)</SelectItem>
                  <SelectItem value="cashier">Cashier or above</SelectItem>
                  <SelectItem value="admin">Admin only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.is_active ? "active" : "inactive"} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v === "active" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.label.trim()}>
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add Threshold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Threshold</AlertDialogTitle>
            <AlertDialogDescription>This approval rule will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
