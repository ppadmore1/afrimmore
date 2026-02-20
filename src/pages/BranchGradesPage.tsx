import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Star, Plus, Trophy } from "lucide-react";
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

export default function BranchGradesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useBranch();
  const [tab, setTab] = useState("monthly");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    branch_id: "",
    period_type: "monthly",
    period_start: format(new Date(), "yyyy-MM-01"),
    period_end: format(new Date(), "yyyy-MM-dd"),
    revenue_score: 70,
    expense_score: 70,
    stock_score: 70,
    attendance_score: 70,
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

  const overall = (form.revenue_score + form.expense_score + form.stock_score + form.attendance_score) / 4;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const avg = (form.revenue_score + form.expense_score + form.stock_score + form.attendance_score) / 4;
      const { error } = await supabase.from("branch_grades").insert({
        branch_id: form.branch_id,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        revenue_score: form.revenue_score,
        expense_score: form.expense_score,
        stock_score: form.stock_score,
        attendance_score: form.attendance_score,
        overall_score: avg,
        grade: scoreToGrade(avg),
        notes: form.notes || null,
        graded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-grades"] });
      toast({ title: "Grade submitted" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Latest grade per branch
  const latestByBranch = branches.map((b) => {
    const branchGrades = grades.filter((g) => g.branch_id === b.id);
    return { branch: b, latest: branchGrades[0] || null };
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Branch Performance Grades</h1>
            <p className="text-muted-foreground mt-1">Grade branches on revenue, expenses, stock management, and attendance</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Grade Branch
            </Button>
          )}
        </div>

        {/* Branch scorecards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestByBranch.map(({ branch, latest }) => (
            <Card key={branch.id} className={latest && latest.overall_score < 60 ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  {branch.name}
                  {latest && (
                    <span className={`text-2xl font-bold ${gradeColor(latest.grade)}`}>{latest.grade}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latest ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-mono">{latest.revenue_score}/100</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="font-mono">{latest.expense_score}/100</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span className="font-mono">{latest.stock_score}/100</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span className="font-mono">{latest.attendance_score}/100</span></div>
                    <div className="flex justify-between pt-1 border-t font-medium"><span>Overall</span><span className={gradeColor(latest.grade)}>{latest.overall_score.toFixed(0)}/100</span></div>
                    <p className="text-xs text-muted-foreground pt-1">Period: {format(new Date(latest.period_start), "MMM d")} – {format(new Date(latest.period_end), "MMM d, yyyy")}</p>
                    {latest.overall_score < 60 && (
                      <Badge variant="destructive" className="text-xs mt-1">Needs explanation</Badge>
                    )}
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
                            <TableCell className="text-center font-medium">{g.overall_score.toFixed(0)}</TableCell>
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

      {/* Grade Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5" /> Grade a Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label>Period Type</Label>
              <Select value={form.period_type} onValueChange={(v) => setForm((p) => ({ ...p, period_type: v }))}>
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
            {[
              { key: "revenue_score", label: "Revenue Score" },
              { key: "expense_score", label: "Expense Control Score" },
              { key: "stock_score", label: "Stock Accuracy Score" },
              { key: "attendance_score", label: "Staff Attendance Score" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="flex justify-between">
                  {label} <span className="font-mono text-primary">{(form as any)[key]}/100</span>
                </Label>
                <Slider
                  value={[(form as any)[key]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setForm((p) => ({ ...p, [key]: v }))}
                  className="mt-2"
                />
              </div>
            ))}
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Overall Score</p>
              <p className={`text-3xl font-bold ${gradeColor(scoreToGrade(overall))}`}>{scoreToGrade(overall)}</p>
              <p className="text-sm font-mono">{overall.toFixed(0)}/100</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Observations or areas for improvement..." className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.branch_id}>
              {saveMutation.isPending ? "Saving..." : "Submit Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
