import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { format, subDays, subWeeks, subMonths, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Zap, Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";

interface Branch { id: string; name: string; }
interface BranchGrade {
  id: string;
  branch_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  revenue_score: number;
  expense_score: number;
  stock_score: number;
  attendance_score: number;
  overall_score: number;
  grade: string;
  notes: string | null;
  created_at: string;
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-600";
  if (grade === "B") return "text-blue-600";
  if (grade === "C") return "text-yellow-600";
  return "text-destructive";
}

function getPeriodRange(periodType: string): { start: string; end: string } {
  const now = new Date();
  const end = format(now, "yyyy-MM-dd");
  let start: string;
  if (periodType === "daily") {
    start = format(startOfDay(now), "yyyy-MM-dd");
  } else if (periodType === "weekly") {
    start = format(startOfWeek(subWeeks(now, 0), { weekStartsOn: 1 }), "yyyy-MM-dd");
  } else {
    start = format(startOfMonth(now), "yyyy-MM-dd");
  }
  return { start, end };
}

async function autoGradeBranch(branchId: string, periodType: string): Promise<{
  revenue_score: number;
  expense_score: number;
  stock_score: number;
  attendance_score: number;
  overall_score: number;
  grade: string;
  notes: string;
  period_start: string;
  period_end: string;
}> {
  const { start, end } = getPeriodRange(periodType);
  const issues: string[] = [];

  // --- Revenue Score ---
  const { data: sales } = await supabase
    .from("pos_sales")
    .select("total")
    .eq("branch_id", branchId)
    .gte("created_at", start)
    .lte("created_at", end + "T23:59:59");

  const totalRevenue = (sales || []).reduce((s, r) => s + Number(r.total), 0);
  const saleCount = (sales || []).length;

  // Compare to previous period for trend
  const prevStart = periodType === "daily"
    ? format(subDays(new Date(start), 1), "yyyy-MM-dd")
    : periodType === "weekly"
      ? format(subWeeks(new Date(start), 1), "yyyy-MM-dd")
      : format(subMonths(new Date(start), 1), "yyyy-MM-dd");

  const { data: prevSales } = await supabase
    .from("pos_sales")
    .select("total")
    .eq("branch_id", branchId)
    .gte("created_at", prevStart)
    .lt("created_at", start);

  const prevRevenue = (prevSales || []).reduce((s, r) => s + Number(r.total), 0);

  let revenueScore = 70; // baseline
  if (prevRevenue > 0) {
    const growth = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    if (growth >= 20) revenueScore = 95;
    else if (growth >= 10) revenueScore = 85;
    else if (growth >= 0) revenueScore = 75;
    else if (growth >= -10) revenueScore = 60;
    else if (growth >= -20) revenueScore = 45;
    else revenueScore = 30;
  } else if (saleCount > 0) {
    revenueScore = 75;
  } else {
    revenueScore = 40;
    issues.push("No sales recorded this period");
  }

  // --- Expense Score (lower expenses relative to revenue = better) ---
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("branch_id", branchId)
    .gte("expense_date", start)
    .lte("expense_date", end);

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);

  let expenseScore = 80;
  if (totalRevenue > 0) {
    const ratio = totalExpenses / totalRevenue;
    if (ratio <= 0.2) expenseScore = 95;
    else if (ratio <= 0.35) expenseScore = 85;
    else if (ratio <= 0.5) expenseScore = 70;
    else if (ratio <= 0.7) expenseScore = 55;
    else { expenseScore = 35; issues.push("Expenses exceed 70% of revenue"); }
  } else if (totalExpenses > 0) {
    expenseScore = 40;
    issues.push("Expenses recorded with no revenue");
  }

  // --- Stock Score ---
  const { data: stockItems } = await supabase
    .from("product_branches")
    .select("stock_quantity, low_stock_threshold")
    .eq("branch_id", branchId);

  const totalItems = (stockItems || []).length;
  const lowStockItems = (stockItems || []).filter(
    (i) => i.stock_quantity <= (i.low_stock_threshold || 10)
  ).length;
  const zeroStockItems = (stockItems || []).filter((i) => i.stock_quantity <= 0).length;

  let stockScore = 80;
  if (totalItems > 0) {
    const lowPct = lowStockItems / totalItems;
    const zeroPct = zeroStockItems / totalItems;
    if (zeroPct > 0.15) { stockScore = 30; issues.push(`${zeroStockItems} products out of stock`); }
    else if (zeroPct > 0.05) { stockScore = 50; issues.push(`${zeroStockItems} products out of stock`); }
    else if (lowPct > 0.3) { stockScore = 55; issues.push(`${lowStockItems} products below threshold`); }
    else if (lowPct > 0.15) stockScore = 70;
    else if (lowPct > 0.05) stockScore = 80;
    else stockScore = 95;
  } else {
    stockScore = 50;
    issues.push("No inventory tracked for this branch");
  }

  // --- Attendance Score ---
  const { data: timeEntries } = await supabase
    .from("employee_time_entries")
    .select("user_id, status, clock_in, clock_out, total_hours")
    .eq("branch_id", branchId)
    .gte("clock_in", start)
    .lte("clock_in", end + "T23:59:59");

  const entries = timeEntries || [];
  const unclosed = entries.filter((e) => e.status === "clocked_in" && !e.clock_out).length;
  const uniqueStaff = new Set(entries.map((e) => e.user_id)).size;

  let attendanceScore = 70;
  if (entries.length > 0) {
    attendanceScore = 80;
    if (unclosed > 0) { attendanceScore -= unclosed * 10; issues.push(`${unclosed} unclosed clock-ins`); }
    if (uniqueStaff >= 3) attendanceScore += 10;
    attendanceScore = Math.max(20, Math.min(100, attendanceScore));
  } else {
    attendanceScore = 40;
    issues.push("No attendance records this period");
  }

  const overall = (revenueScore + expenseScore + stockScore + attendanceScore) / 4;
  const grade = scoreToGrade(overall);
  const summary = issues.length > 0
    ? `Auto-graded. Issues: ${issues.join("; ")}`
    : `Auto-graded. Revenue: $${totalRevenue.toFixed(0)}, ${saleCount} sales. All metrics healthy.`;

  return {
    revenue_score: revenueScore,
    expense_score: expenseScore,
    stock_score: stockScore,
    attendance_score: attendanceScore,
    overall_score: Math.round(overall),
    grade,
    notes: summary,
    period_start: start,
    period_end: end,
  };
}

export default function BranchGradesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useBranch();
  const [tab, setTab] = useState("monthly");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [periodType, setPeriodType] = useState("monthly");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof autoGradeBranch>> | null>(null);
  const [grading, setGrading] = useState(false);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ["branch-grades", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_grades")
        .select("*")
        .eq("period_type", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BranchGrade[];
    },
  });

  const runAutoGrade = async () => {
    if (!selectedBranch) return;
    setGrading(true);
    try {
      const result = await autoGradeBranch(selectedBranch, periodType);
      setPreview(result);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGrading(false);
    }
  };

  const gradeAllMutation = useMutation({
    mutationFn: async () => {
      for (const branch of branches) {
        const result = await autoGradeBranch(branch.id, periodType);
        const { error } = await supabase.from("branch_grades").insert({
          branch_id: branch.id,
          period_type: periodType,
          period_start: result.period_start,
          period_end: result.period_end,
          revenue_score: result.revenue_score,
          expense_score: result.expense_score,
          stock_score: result.stock_score,
          attendance_score: result.attendance_score,
          overall_score: result.overall_score,
          grade: result.grade,
          notes: result.notes,
          graded_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-grades"] });
      toast({ title: "All branches graded automatically" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!preview || !selectedBranch) throw new Error("No preview");
      const { error } = await supabase.from("branch_grades").insert({
        branch_id: selectedBranch,
        period_type: periodType,
        period_start: preview.period_start,
        period_end: preview.period_end,
        revenue_score: preview.revenue_score,
        expense_score: preview.expense_score,
        stock_score: preview.stock_score,
        attendance_score: preview.attendance_score,
        overall_score: preview.overall_score,
        grade: preview.grade,
        notes: preview.notes,
        graded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-grades"] });
      toast({ title: "Grade saved" });
      setDialogOpen(false);
      setPreview(null);
      setSelectedBranch("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const latestByBranch = branches.map((b) => {
    const branchGrades = grades.filter((g) => g.branch_id === b.id);
    return { branch: b, latest: branchGrades[0] || null };
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Branch Performance Grades</h1>
            <p className="text-muted-foreground mt-1">Auto-graded from sales, expenses, stock & attendance data</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => gradeAllMutation.mutate()} disabled={gradeAllMutation.isPending} className="gap-2">
                {gradeAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Grade All Branches
              </Button>
              <Button onClick={() => { setDialogOpen(true); setPreview(null); setSelectedBranch(""); }} className="gap-2">
                <Zap className="w-4 h-4" /> Run Auto Grade
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestByBranch.map(({ branch, latest }) => (
            <Card key={branch.id} className={latest && latest.overall_score < 60 ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  {branch.name}
                  {latest && <span className={`text-2xl font-bold ${gradeColor(latest.grade)}`}>{latest.grade}</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latest ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-mono">{latest.revenue_score}/100</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="font-mono">{latest.expense_score}/100</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span className="font-mono">{latest.stock_score}/100</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span className="font-mono">{latest.attendance_score}/100</span></div>
                    <div className="flex justify-between pt-1 border-t font-medium"><span>Overall</span><span className={gradeColor(latest.grade)}>{latest.overall_score}/100</span></div>
                    <p className="text-xs text-muted-foreground pt-1">Period: {format(new Date(latest.period_start), "MMM d")} – {format(new Date(latest.period_end), "MMM d, yyyy")}</p>
                    {latest.overall_score < 60 && <Badge variant="destructive" className="text-xs mt-1">Needs attention</Badge>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No grades yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
          <TabsContent value={tab}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading...</div>
                ) : grades.length === 0 ? (
                  <div className="py-16 text-center">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">No grades for this period yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Revenue</TableHead>
                        <TableHead className="text-center">Expenses</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-center">Attendance</TableHead>
                        <TableHead className="text-center">Overall</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map((g) => {
                        const branch = branches.find((b) => b.id === g.branch_id);
                        return (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{branch?.name || "Unknown"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(g.period_start), "MMM d")} – {format(new Date(g.period_end), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-center">{g.revenue_score}</TableCell>
                            <TableCell className="text-center">{g.expense_score}</TableCell>
                            <TableCell className="text-center">{g.stock_score}</TableCell>
                            <TableCell className="text-center">{g.attendance_score}</TableCell>
                            <TableCell className="text-center font-medium">{g.overall_score}</TableCell>
                            <TableCell className={`text-center text-lg font-bold ${gradeColor(g.grade)}`}>{g.grade}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Auto Grade Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5" /> Auto Grade Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch</Label>
              <Select value={selectedBranch} onValueChange={(v) => { setSelectedBranch(v); setPreview(null); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period</Label>
              <Select value={periodType} onValueChange={(v) => { setPeriodType(v); setPreview(null); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!preview && (
              <Button onClick={runAutoGrade} disabled={!selectedBranch || grading} className="w-full gap-2">
                {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {grading ? "Analyzing..." : "Run Auto Grade"}
              </Button>
            )}

            {preview && (
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className={`text-4xl font-bold ${gradeColor(preview.grade)}`}>{preview.grade}</p>
                  <p className="text-sm font-mono text-muted-foreground">{preview.overall_score}/100</p>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-mono">{preview.revenue_score}/100</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expense Control</span><span className="font-mono">{preview.expense_score}/100</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stock Health</span><span className="font-mono">{preview.stock_score}/100</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span className="font-mono">{preview.attendance_score}/100</span></div>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{preview.notes}</p>
              </div>
            )}
          </div>
          {preview && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Grade"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
