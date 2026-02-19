import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subHours } from "date-fns";
import { Plus, Trash2, Receipt, TrendingDown, Calendar, Filter, Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { generateCSV, downloadCSV } from "@/lib/csv";

type Period = "today" | "yesterday" | "this_week" | "this_month" | "this_year" | "all";

const CATEGORIES = [
  "General", "Rent", "Utilities", "Salaries", "Transport", "Supplies",
  "Marketing", "Maintenance", "Insurance", "Taxes", "Equipment", "Other"
];

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  vendor: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    category: "General",
    description: "",
    amount: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "cash",
    vendor: "",
    reference: "",
    notes: "",
  });

  useEffect(() => { loadExpenses(); }, []);

  async function loadExpenses() {
    try {
      const { data, error } = await supabase
        .from("expenses" as any)
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      setExpenses((data as unknown as Expense[]) || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Error loading expenses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function generateExpenseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("expenses" as any)
      .select("expense_number")
      .ilike("expense_number", `EXP-${year}-%`)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = (data as any)?.[0]?.expense_number;
    const seq = last ? parseInt(last.split("-")[2]) + 1 : 1;
    return `EXP-${year}-${String(seq).padStart(5, "0")}`;
  }

  async function handleSave() {
    if (!form.description || !form.amount) {
      toast({ title: "Description and amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const expense_number = await generateExpenseNumber();
      const { error } = await supabase.from("expenses" as any).insert({
        expense_number,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        vendor: form.vendor || null,
        reference: form.reference || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
      toast({ title: "Expense recorded successfully" });
      setIsDialogOpen(false);
      setForm({ category: "General", description: "", amount: "", expense_date: format(new Date(), "yyyy-MM-dd"), payment_method: "cash", vendor: "", reference: "", notes: "" });
      loadExpenses();
    } catch (e) {
      console.error(e);
      toast({ title: "Error saving expense", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting expense", variant: "destructive" });
    } else {
      setExpenses(expenses.filter(e => e.id !== id));
      toast({ title: "Expense deleted" });
    }
  }

  // Filter by period
  const filteredExpenses = expenses.filter(expense => {
    const d = new Date(expense.expense_date);
    const now = new Date();
    let inPeriod = true;
    if (period === "today") inPeriod = d >= startOfDay(now) && d <= endOfDay(now);
    else if (period === "yesterday") {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      inPeriod = d >= startOfDay(y) && d <= endOfDay(y);
    }
    else if (period === "this_week") inPeriod = d >= startOfWeek(now) && d <= endOfWeek(now);
    else if (period === "this_month") inPeriod = d >= startOfMonth(now) && d <= endOfMonth(now);
    else if (period === "this_year") inPeriod = d >= startOfYear(now) && d <= endOfYear(now);

    const inCategory = categoryFilter === "all" || expense.category === categoryFilter;
    return inPeriod && inCategory;
  });

  const totalAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.map(cat => ({
    name: cat,
    total: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);

  const handleExport = () => {
    const csv = generateCSV(filteredExpenses, [
      { key: "expense_number", header: "Expense #" },
      { key: "expense_date", header: "Date" },
      { key: "category", header: "Category" },
      { key: "description", header: "Description" },
      { key: "vendor", header: "Vendor" },
      { key: "amount", header: "Amount" },
      { key: "payment_method", header: "Payment Method" },
    ]);
    downloadCSV(csv, `expenses_${period}_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Expense Tracker</h1>
            <p className="text-muted-foreground mt-1">Track and manage business expenses</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={filteredExpenses.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Record Expense</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount *</Label>
                      <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vendor / Supplier</Label>
                      <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Reference #</Label>
                      <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Receipt/Invoice #" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional notes..." />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Record Expense"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-destructive/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold font-mono text-destructive">${totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{filteredExpenses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {byCategory.slice(0, 2).map(cat => (
            <Card key={cat.name}>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{cat.name}</p>
                  <p className="text-2xl font-bold font-mono">${cat.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{((cat.total / totalAmount) * 100).toFixed(1)}% of total</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category Breakdown */}
        {byCategory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Breakdown by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {byCategory.sort((a, b) => b.total - a.total).map(cat => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-28 text-sm font-medium shrink-0">{cat.name}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(cat.total / totalAmount) * 100}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-mono font-medium">${cat.total.toFixed(2)}</div>
                    <div className="w-12 text-right text-xs text-muted-foreground">{((cat.total / totalAmount) * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingDown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No expenses recorded for this period</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-mono text-xs">{expense.expense_number}</TableCell>
                      <TableCell className="text-sm">{format(new Date(expense.expense_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{expense.vendor || "—"}</TableCell>
                      <TableCell className="capitalize text-sm">{expense.payment_method?.replace("_", " ")}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-destructive">
                        ${expense.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
