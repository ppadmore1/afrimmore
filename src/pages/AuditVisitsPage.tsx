import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { Search, Play, ShieldAlert, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
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

interface AutoAuditResult {
  stock_ok: boolean;
  cash_ok: boolean;
  staff_ok: boolean;
  reports_ok: boolean;
  stock_notes: string;
  cash_notes: string;
  staff_notes: string;
  reports_notes: string;
  overall_notes: string;
  overall_score: number;
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  return ok ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />;
}

async function runAutoAudit(branchId: string): Promise<AutoAuditResult> {
  const today = new Date();
  const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

  // Pull all data in parallel
  const [stockRes, salesRes, paymentsRes, timeRes, reportsRes] = await Promise.all([
    // Stock: check for low-stock products in this branch
    supabase
      .from("product_branches")
      .select("stock_quantity, low_stock_threshold, product_id")
      .eq("branch_id", branchId),
    // Cash: POS sales in last 7 days
    supabase
      .from("pos_sales")
      .select("total, amount_paid, change_amount, payment_method, sale_number")
      .eq("branch_id", branchId)
      .gte("created_at", sevenDaysAgo),
    // Payments in last 7 days
    supabase
      .from("payments")
      .select("amount, payment_method")
      .gte("created_at", sevenDaysAgo),
    // Staff: time entries in last 7 days for this branch
    supabase
      .from("employee_time_entries")
      .select("user_id, clock_in, clock_out, status, total_hours")
      .eq("branch_id", branchId)
      .gte("clock_in", sevenDaysAgo),
    // Reports: branch reports for this branch
    supabase
      .from("branch_reports")
      .select("status, report_type, total_sales, total_expenses")
      .eq("branch_id", branchId)
      .gte("created_at", sevenDaysAgo),
  ]);

  // --- STOCK ANALYSIS ---
  const stockItems = stockRes.data || [];
  const totalProducts = stockItems.length;
  const lowStockItems = stockItems.filter(
    (s) => s.stock_quantity <= (s.low_stock_threshold || 10)
  );
  const zeroStockItems = stockItems.filter((s) => s.stock_quantity <= 0);
  const lowStockPct = totalProducts > 0 ? (lowStockItems.length / totalProducts) * 100 : 0;
  const stockOk = lowStockPct < 20 && zeroStockItems.length === 0;
  const stockNotes = totalProducts === 0
    ? "No inventory assigned to this branch."
    : `${totalProducts} products tracked. ${lowStockItems.length} low stock (${lowStockPct.toFixed(0)}%), ${zeroStockItems.length} out of stock.`;

  // --- CASH ANALYSIS ---
  const sales = salesRes.data || [];
  const totalSalesAmount = sales.reduce((s, r) => s + Number(r.total), 0);
  const totalPaid = sales.reduce((s, r) => s + Number(r.amount_paid), 0);
  const cashDiscrepancy = Math.abs(totalPaid - totalSalesAmount - sales.reduce((s, r) => s + Number(r.change_amount), 0));
  const cashOk = cashDiscrepancy < 1 && sales.length > 0;
  const cashNotes = sales.length === 0
    ? "No POS sales recorded in the last 7 days."
    : `${sales.length} sales totaling ${totalSalesAmount.toFixed(2)}. Cash collected: ${totalPaid.toFixed(2)}. Discrepancy: ${cashDiscrepancy.toFixed(2)}.`;

  // --- STAFF ANALYSIS ---
  const timeEntries = timeRes.data || [];
  const uniqueStaff = new Set(timeEntries.map((t) => t.user_id)).size;
  const openEntries = timeEntries.filter((t) => t.status === "clocked_in" && !t.clock_out);
  const avgHours = timeEntries.length > 0
    ? timeEntries.reduce((s, t) => s + Number(t.total_hours || 0), 0) / timeEntries.length
    : 0;
  const staffOk = uniqueStaff > 0 && openEntries.length <= 1;
  const staffNotes = timeEntries.length === 0
    ? "No staff time entries recorded for this branch in the last 7 days."
    : `${uniqueStaff} staff member(s) logged ${timeEntries.length} entries. Avg hours: ${avgHours.toFixed(1)}h. ${openEntries.length} unclosed session(s).`;

  // --- REPORTS ANALYSIS ---
  const reports = reportsRes.data || [];
  const submittedReports = reports.filter((r) => r.status !== "pending");
  const reportsOk = reports.length > 0 && submittedReports.length >= reports.length * 0.5;
  const reportsNotes = reports.length === 0
    ? "No branch reports submitted in the last 7 days."
    : `${reports.length} report(s) found. ${submittedReports.length} submitted/approved. ${reports.length - submittedReports.length} still pending.`;

  // --- OVERALL ---
  const checks = [stockOk, cashOk, staffOk, reportsOk];
  const passed = checks.filter(Boolean).length;
  const overallScore = Math.round((passed / 4) * 100);

  const issues: string[] = [];
  if (!stockOk) issues.push("stock concerns");
  if (!cashOk) issues.push("cash discrepancies");
  if (!staffOk) issues.push("staff attendance gaps");
  if (!reportsOk) issues.push("incomplete reports");

  const overallNotes = issues.length === 0
    ? `All checks passed. Branch is operating well with ${sales.length} sales and ${uniqueStaff} active staff in the last 7 days.`
    : `Issues detected: ${issues.join(", ")}. Score: ${overallScore}%. Review individual sections for details.`;

  return {
    stock_ok: stockOk,
    cash_ok: cashOk,
    staff_ok: staffOk,
    reports_ok: reportsOk,
    stock_notes: stockNotes,
    cash_notes: cashNotes,
    staff_notes: staffNotes,
    reports_notes: reportsNotes,
    overall_notes: overallNotes,
    overall_score: overallScore,
  };
}

export default function AuditVisitsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [detailAudit, setDetailAudit] = useState<AuditVisit | null>(null);
  const [search, setSearch] = useState("");
  const [auditPreview, setAuditPreview] = useState<AutoAuditResult | null>(null);

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

  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const result = await runAutoAudit(selectedBranchId);
      setAuditPreview(result);
      return result;
    },
    onError: (e: any) => toast({ title: "Error running audit", description: e.message, variant: "destructive" }),
  });

  const saveAuditMutation = useMutation({
    mutationFn: async () => {
      if (!auditPreview) throw new Error("No audit data");
      const { error } = await supabase.from("audit_visits").insert({
        branch_id: selectedBranchId,
        auditor_id: user?.id,
        visit_date: format(new Date(), "yyyy-MM-dd"),
        is_surprise: true,
        status: "completed",
        stock_ok: auditPreview.stock_ok,
        cash_ok: auditPreview.cash_ok,
        staff_ok: auditPreview.staff_ok,
        reports_ok: auditPreview.reports_ok,
        stock_notes: auditPreview.stock_notes,
        cash_notes: auditPreview.cash_notes,
        staff_notes: auditPreview.staff_notes,
        reports_notes: auditPreview.reports_notes,
        overall_notes: auditPreview.overall_notes,
        overall_score: auditPreview.overall_score,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-visits"] });
      toast({ title: "Audit saved successfully" });
      setRunDialogOpen(false);
      setAuditPreview(null);
      setSelectedBranchId("");
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
      ? Math.round(audits.filter((a) => a.overall_score !== null).reduce((s, a) => s + (a.overall_score || 0), 0) / (audits.filter((a) => a.overall_score !== null).length || 1))
      : 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Surprise Audits</h1>
            <p className="text-muted-foreground mt-1">Select a branch and run an automatic audit report</p>
          </div>
          <Button onClick={() => { setRunDialogOpen(true); setAuditPreview(null); setSelectedBranchId(""); }} className="gap-2">
            <Play className="w-4 h-4" /> Run Audit
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Audits</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{stats.completed}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Avg Score</p><p className="text-2xl font-bold font-mono">{stats.avgScore}%</p></CardContent></Card>
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
                          <Badge variant={a.status === "completed" ? "default" : "secondary"}>{a.status}</Badge>
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

      {/* Run Audit Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Run Auto Audit</DialogTitle>
          </DialogHeader>

          {!auditPreview ? (
            <div className="space-y-4">
              <div>
                <Label>Select Branch</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                This will automatically check stock levels, cash/sales records, staff attendance, and report submissions for the last 7 days.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRunDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => runAuditMutation.mutate()}
                  disabled={!selectedBranchId || runAuditMutation.isPending}
                  className="gap-2"
                >
                  {runAuditMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Audit</>}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted text-center">
                <p className="text-sm text-muted-foreground">Audit Score</p>
                <p className={`text-4xl font-bold font-mono ${auditPreview.overall_score >= 75 ? "text-green-600" : auditPreview.overall_score >= 50 ? "text-yellow-600" : "text-destructive"}`}>
                  {auditPreview.overall_score}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">{branches.find(b => b.id === selectedBranchId)?.name} — {format(new Date(), "MMM d, yyyy")}</p>
              </div>

              {[
                { label: "Stock Levels", ok: auditPreview.stock_ok, notes: auditPreview.stock_notes },
                { label: "Cash & Payments", ok: auditPreview.cash_ok, notes: auditPreview.cash_notes },
                { label: "Staff Attendance", ok: auditPreview.staff_ok, notes: auditPreview.staff_notes },
                { label: "Report Submissions", ok: auditPreview.reports_ok, notes: auditPreview.reports_notes },
              ].map(({ label, ok, notes }) => (
                <div key={label} className="flex gap-3 p-3 border border-border rounded-lg">
                  <StatusIcon ok={ok} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{label}: <span className={ok ? "text-green-600" : "text-destructive"}>{ok ? "Pass" : "Fail"}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{notes}</p>
                  </div>
                </div>
              ))}

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                <p className="text-sm">{auditPreview.overall_notes}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setAuditPreview(null); }}>Re-run</Button>
                <Button onClick={() => saveAuditMutation.mutate()} disabled={saveAuditMutation.isPending}>
                  {saveAuditMutation.isPending ? "Saving..." : "Save Audit Report"}
                </Button>
              </DialogFooter>
            </div>
          )}
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
