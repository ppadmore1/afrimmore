import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { FileBarChart2, Plus, CheckCircle, Clock, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";

interface Branch { id: string; name: string; }
interface BranchReport {
  id: string;
  branch_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  status: string;
  total_sales: number;
  total_expenses: number;
  total_profit: number;
  stock_movements_count: number;
  notes: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "secondary",
  submitted: "outline",
  approved: "default",
};

export default function BranchReportsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, currentBranch } = useBranch();
  const [tab, setTab] = useState("daily");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    branch_id: currentBranch?.id || "",
    report_type: "daily",
    period_start: format(new Date(), "yyyy-MM-dd"),
    period_end: format(new Date(), "yyyy-MM-dd"),
    total_sales: "",
    total_expenses: "",
    notes: "",
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["branch-reports", tab],
    queryFn: async () => {
      let q = supabase.from("branch_reports").select("*").eq("report_type", tab).order("period_start", { ascending: false });
      if (!isAdmin && currentBranch) q = q.eq("branch_id", currentBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as BranchReport[];
    },
  });

  function prefillDates(type: string) {
    const now = new Date();
    let start: Date, end: Date;
    if (type === "daily") { start = startOfDay(now); end = endOfDay(now); }
    else if (type === "weekly") { start = startOfWeek(now); end = endOfWeek(now); }
    else { start = startOfMonth(now); end = endOfMonth(now); }
    setForm((p) => ({
      ...p,
      report_type: type,
      period_start: format(start, "yyyy-MM-dd"),
      period_end: format(end, "yyyy-MM-dd"),
    }));
  }

  function openDialog(type: string) {
    prefillDates(type);
    setForm((p) => ({ ...p, branch_id: currentBranch?.id || "", total_sales: "", total_expenses: "", notes: "" }));
    setDialogOpen(true);
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const sales = Number(form.total_sales) || 0;
      const expenses = Number(form.total_expenses) || 0;
      const profit = sales - expenses;
      const { error } = await supabase.from("branch_reports").insert({
        branch_id: form.branch_id,
        report_type: form.report_type,
        period_start: form.period_start,
        period_end: form.period_end,
        total_sales: sales,
        total_expenses: expenses,
        total_profit: profit,
        notes: form.notes || null,
        status: "submitted",
        submitted_by: user?.id,
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-reports"] });
      toast({ title: "Report submitted successfully" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branch_reports").update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-reports"] });
      toast({ title: "Report approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function exportCSV() {
    const rows = [
      ["Branch ID", "Period", "Type", "Status", "Sales", "Expenses", "Profit"],
      ...reports.map((r) => [
        r.branch_id,
        `${r.period_start} to ${r.period_end}`,
        r.report_type,
        r.status,
        r.total_sales,
        r.total_expenses,
        r.total_profit,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `branch-reports-${tab}-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
  }

  const totals = reports.reduce(
    (acc, r) => ({ sales: acc.sales + r.total_sales, expenses: acc.expenses + r.total_expenses, profit: acc.profit + r.total_profit }),
    { sales: 0, expenses: 0, profit: 0 }
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Branch Reports</h1>
            <p className="text-muted-foreground mt-1">Submit and track daily, weekly, and monthly performance reports</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button onClick={() => openDialog(tab)} className="gap-2">
              <Plus className="w-4 h-4" /> Submit Report
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-bold font-mono text-foreground">${totals.sales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold font-mono text-destructive">${totals.expenses.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className={`text-2xl font-bold font-mono ${totals.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                ${totals.profit.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          {["daily", "weekly", "monthly"].map((type) => (
            <TabsContent key={type} value={type}>
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading...</div>
                  ) : reports.length === 0 ? (
                    <div className="py-16 text-center">
                      <FileBarChart2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">No {type} reports yet. Submit the first one.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((r) => {
                          const branch = branches.find((b) => b.id === r.branch_id);
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="text-sm">
                                {format(new Date(r.period_start), "MMM d")} – {format(new Date(r.period_end), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>{branch?.name || r.branch_id.slice(0, 8)}</TableCell>
                              <TableCell className="text-right font-mono">${r.total_sales.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono text-destructive">${r.total_expenses.toLocaleString()}</TableCell>
                              <TableCell className={`text-right font-mono font-medium ${r.total_profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                                ${r.total_profit.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={(STATUS_COLORS[r.status] || "secondary") as any}>
                                  {r.status === "approved" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                                  {r.status}
                                </Badge>
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="text-right">
                                  {r.status !== "approved" && (
                                    <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                                      Approve
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Submit Report Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Branch Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin && (
              <div>
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm((p) => ({ ...p, branch_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Report Type</Label>
              <Select value={form.report_type} onValueChange={(v) => { prefillDates(v); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={form.period_start} onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={form.period_end} onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Sales ($)</Label>
                <Input type="number" min={0} value={form.total_sales} onChange={(e) => setForm((p) => ({ ...p, total_sales: e.target.value }))} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label>Total Expenses ($)</Label>
                <Input type="number" min={0} value={form.total_expenses} onChange={(e) => setForm((p) => ({ ...p, total_expenses: e.target.value }))} className="mt-1" placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Notes / Challenges</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any challenges, highlights, or context..." className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !form.branch_id}>
              {submitMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
