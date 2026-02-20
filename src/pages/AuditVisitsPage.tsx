import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Plus, ShieldAlert, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Branch { id: string; name: string; }
interface AuditVisit {
  id: string;
  branch_id: string;
  auditor_id: string;
  visit_date: string;
  status: string;
  stock_ok: boolean | null;
  cash_ok: boolean | null;
  staff_ok: boolean | null;
  reports_ok: boolean | null;
  stock_notes: string | null;
  cash_notes: string | null;
  staff_notes: string | null;
  reports_notes: string | null;
  overall_notes: string | null;
  overall_score: number | null;
  is_surprise: boolean;
  created_at: string;
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  return ok ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />;
}

export default function AuditVisitsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailAudit, setDetailAudit] = useState<AuditVisit | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    branch_id: "",
    visit_date: format(new Date(), "yyyy-MM-dd"),
    is_surprise: true,
    stock_ok: null as boolean | null,
    cash_ok: null as boolean | null,
    staff_ok: null as boolean | null,
    reports_ok: null as boolean | null,
    stock_notes: "",
    cash_notes: "",
    staff_notes: "",
    reports_notes: "",
    overall_notes: "",
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["audit-visits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_visits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuditVisit[];
    },
  });

  function calcScore(): number {
    const checks = [form.stock_ok, form.cash_ok, form.staff_ok, form.reports_ok];
    const passed = checks.filter((c) => c === true).length;
    const assessed = checks.filter((c) => c !== null).length;
    return assessed > 0 ? Math.round((passed / assessed) * 100) : 0;
  }

  const saveMutation = useMutation({
    mutationFn: async (complete: boolean) => {
      const score = calcScore();
      const { error } = await supabase.from("audit_visits").insert({
        branch_id: form.branch_id,
        auditor_id: user?.id,
        visit_date: form.visit_date,
        is_surprise: form.is_surprise,
        status: complete ? "completed" : "in_progress",
        stock_ok: form.stock_ok,
        cash_ok: form.cash_ok,
        staff_ok: form.staff_ok,
        reports_ok: form.reports_ok,
        stock_notes: form.stock_notes || null,
        cash_notes: form.cash_notes || null,
        staff_notes: form.staff_notes || null,
        reports_notes: form.reports_notes || null,
        overall_notes: form.overall_notes || null,
        overall_score: score,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-visits"] });
      toast({ title: "Audit visit recorded" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = audits.filter((a) => {
    const branch = branches.find((b) => b.id === a.branch_id);
    return !search || branch?.name.toLowerCase().includes(search.toLowerCase());
  });

  const stats = {
    total: audits.length,
    completed: audits.filter((a) => a.status === "completed").length,
    avgScore: audits.length > 0
      ? Math.round(audits.filter((a) => a.overall_score !== null).reduce((s, a) => s + (a.overall_score || 0), 0) / audits.filter((a) => a.overall_score !== null).length || 0)
      : 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Surprise Audits</h1>
            <p className="text-muted-foreground mt-1">Conduct secret audits on branches — results visible only to admin</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Audit
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Audits</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Avg Score</p>
              <p className="text-2xl font-bold font-mono">{stats.avgScore}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by branch..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No audit visits recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Cash</TableHead>
                    <TableHead className="text-center">Staff</TableHead>
                    <TableHead className="text-center">Reports</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const branch = branches.find((b) => b.id === a.branch_id);
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetailAudit(a)}>
                        <TableCell className="font-medium">{branch?.name || "Unknown"}</TableCell>
                        <TableCell>{format(new Date(a.visit_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-center"><StatusIcon ok={a.stock_ok} /></TableCell>
                        <TableCell className="text-center"><StatusIcon ok={a.cash_ok} /></TableCell>
                        <TableCell className="text-center"><StatusIcon ok={a.staff_ok} /></TableCell>
                        <TableCell className="text-center"><StatusIcon ok={a.reports_ok} /></TableCell>
                        <TableCell className="text-center font-mono font-medium">
                          {a.overall_score !== null ? `${a.overall_score}%` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.is_surprise ? "destructive" : "outline"}>
                            {a.is_surprise ? "Surprise" : "Scheduled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.status === "completed" ? "default" : "secondary"}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">View</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Audit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Conduct Audit Visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm((p) => ({ ...p, branch_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visit Date</Label>
                <Input type="date" value={form.visit_date} onChange={(e) => setForm((p) => ({ ...p, visit_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_surprise}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_surprise: v }))}
              />
              <Label>This is a surprise / unannounced visit</Label>
            </div>
            <div className="space-y-3">
              {[
                { key: "stock_ok", notesKey: "stock_notes", label: "Stock Levels", placeholder: "e.g. Inventory matches records, no unexplained shortages" },
                { key: "cash_ok", notesKey: "cash_notes", label: "Cash & Payments", placeholder: "e.g. Cash drawer matches POS totals" },
                { key: "staff_ok", notesKey: "staff_notes", label: "Staff Behavior & Compliance", placeholder: "e.g. Staff present, professional conduct observed" },
                { key: "reports_ok", notesKey: "reports_notes", label: "Report Accuracy", placeholder: "e.g. Sales reports match system records" },
              ].map(({ key, notesKey, label, placeholder }) => (
                <div key={key} className="p-3 border border-border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">{label}</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant={(form as any)[key] === true ? "default" : "outline"} onClick={() => setForm((p) => ({ ...p, [key]: true }))}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pass
                      </Button>
                      <Button size="sm" variant={(form as any)[key] === false ? "destructive" : "outline"} onClick={() => setForm((p) => ({ ...p, [key]: false }))}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Fail
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={(form as any)[notesKey]}
                    onChange={(e) => setForm((p) => ({ ...p, [notesKey]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label>Overall Observations</Label>
              <Textarea value={form.overall_notes} onChange={(e) => setForm((p) => ({ ...p, overall_notes: e.target.value }))} placeholder="Overall summary of findings..." className="mt-1" rows={3} />
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Estimated Score</p>
              <p className="text-3xl font-bold font-mono">{calcScore()}%</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending || !form.branch_id}>
              Save In Progress
            </Button>
            <Button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending || !form.branch_id}>
              {saveMutation.isPending ? "Saving..." : "Complete Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View */}
      <Dialog open={!!detailAudit} onOpenChange={() => setDetailAudit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Audit Details</DialogTitle>
          </DialogHeader>
          {detailAudit && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{branches.find((b) => b.id === detailAudit.branch_id)?.name}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span>{format(new Date(detailAudit.visit_date), "MMM d, yyyy")}</span></div>
                <div><span className="text-muted-foreground">Score:</span> <span className="font-bold">{detailAudit.overall_score}%</span></div>
                <div><span className="text-muted-foreground">Type:</span> <Badge variant={detailAudit.is_surprise ? "destructive" : "outline"}>{detailAudit.is_surprise ? "Surprise" : "Scheduled"}</Badge></div>
              </div>
              {[
                { label: "Stock", ok: detailAudit.stock_ok, notes: detailAudit.stock_notes },
                { label: "Cash", ok: detailAudit.cash_ok, notes: detailAudit.cash_notes },
                { label: "Staff", ok: detailAudit.staff_ok, notes: detailAudit.staff_notes },
                { label: "Reports", ok: detailAudit.reports_ok, notes: detailAudit.reports_notes },
              ].map(({ label, ok, notes }) => (
                <div key={label} className="flex gap-2 p-2 bg-muted/50 rounded">
                  <StatusIcon ok={ok} />
                  <div>
                    <p className="font-medium">{label}: {ok === true ? "Pass" : ok === false ? "Fail" : "N/A"}</p>
                    {notes && <p className="text-muted-foreground text-xs">{notes}</p>}
                  </div>
                </div>
              ))}
              {detailAudit.overall_notes && (
                <div>
                  <p className="font-medium text-muted-foreground">Overall Notes:</p>
                  <p>{detailAudit.overall_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
