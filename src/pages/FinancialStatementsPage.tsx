import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, TrendingUp, TrendingDown, DollarSign, ArrowRight, Minus } from "lucide-react";

type Period = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "last30";

function getPeriodBounds(period: Period) {
  const now = new Date();
  switch (period) {
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(startOfMonth(now), "MMMM yyyy") };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm), label: format(startOfMonth(lm), "MMMM yyyy") };
    }
    case "thisQuarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const qs = new Date(now.getFullYear(), qMonth, 1);
      const qe = new Date(now.getFullYear(), qMonth + 3, 0);
      return { start: qs, end: qe, label: `Q${Math.floor(qMonth / 3) + 1} ${now.getFullYear()}` };
    }
    case "thisYear":
      return { start: startOfYear(now), end: endOfYear(now), label: `FY ${now.getFullYear()}` };
    case "last30":
      return { start: subDays(now, 30), end: now, label: "Last 30 Days" };
  }
}

interface FinancialData {
  invoiceRevenue: number;
  posRevenue: number;
  paymentsCash: number;
  paymentsBank: number;
  paymentsCard: number;
  paymentsOther: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  inventoryValue: number;
  accountsReceivable: number;
  totalPaymentsReceived: number;
}

export default function FinancialStatementsPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialData | null>(null);

  const bounds = useMemo(() => getPeriodBounds(period), [period]);

  useEffect(() => {
    loadFinancialData();
  }, [period]);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const startStr = bounds.start.toISOString();
      const endStr = bounds.end.toISOString();

      const [invoicesRes, posRes, paymentsRes, expensesRes, productsRes] = await Promise.all([
        supabase.from("invoices").select("total, amount_paid, status").gte("created_at", startStr).lte("created_at", endStr),
        supabase.from("pos_sales").select("total").gte("created_at", startStr).lte("created_at", endStr),
        supabase.from("payments").select("amount, payment_method").gte("created_at", startStr).lte("created_at", endStr),
        supabase.from("expenses").select("amount, category").gte("expense_date", format(bounds.start, "yyyy-MM-dd")).lte("expense_date", format(bounds.end, "yyyy-MM-dd")),
        supabase.from("products").select("stock_quantity, unit_price, cost_price"),
      ]);

      const invoices = invoicesRes.data || [];
      const posSales = posRes.data || [];
      const payments = paymentsRes.data || [];
      const expenses = expensesRes.data || [];
      const products = productsRes.data || [];

      const invoiceRevenue = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
      const posRevenue = posSales.reduce((s, p) => s + Number(p.total || 0), 0);
      const accountsReceivable = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

      let paymentsCash = 0, paymentsBank = 0, paymentsCard = 0, paymentsOther = 0;
      const totalPaymentsReceived = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      payments.forEach(p => {
        const amt = Number(p.amount || 0);
        if (p.payment_method === "cash") paymentsCash += amt;
        else if (p.payment_method === "bank_transfer") paymentsBank += amt;
        else if (p.payment_method === "card") paymentsCard += amt;
        else paymentsOther += amt;
      });

      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const expensesByCategory: Record<string, number> = {};
      expenses.forEach(e => {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount || 0);
      });

      const inventoryValue = products.reduce((s, p) => s + (Number(p.stock_quantity || 0) * Number(p.cost_price || p.unit_price || 0)), 0);

      setData({ invoiceRevenue, posRevenue, paymentsCash, paymentsBank, paymentsCard, paymentsOther, totalExpenses, expensesByCategory, inventoryValue, accountsReceivable, totalPaymentsReceived });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = (data?.invoiceRevenue || 0) + (data?.posRevenue || 0);
  const netIncome = totalRevenue - (data?.totalExpenses || 0);
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - (data?.totalExpenses || 0)) / totalRevenue * 100) : 0;

  function LineItem({ label, amount, bold, indent, negative }: { label: string; amount: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
    return (
      <div className={`flex justify-between py-2 ${bold ? "font-bold border-t border-b border-border" : ""} ${indent ? "pl-6" : ""}`}>
        <span className="text-sm">{negative && amount > 0 ? `(${label})` : label}</span>
        <span className={`text-sm font-mono ${amount < 0 ? "text-destructive" : ""}`}>
          {negative ? `(${Math.abs(amount).toLocaleString("en-US", { style: "currency", currency: "USD" })})` : amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </span>
      </div>
    );
  }

  function SectionHeader({ title }: { title: string }) {
    return <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-1 border-b border-border">{title}</div>;
  }

  function exportCSV(statementType: string) {
    if (!data) return;
    let rows: string[][] = [];

    if (statementType === "pnl") {
      rows = [
        ["Income Statement", bounds.label],
        [""],
        ["Revenue"],
        ["Invoice Sales", data.invoiceRevenue.toFixed(2)],
        ["POS Sales", data.posRevenue.toFixed(2)],
        ["Total Revenue", totalRevenue.toFixed(2)],
        [""],
        ["Expenses"],
        ...Object.entries(data.expensesByCategory).map(([cat, amt]) => [cat, amt.toFixed(2)]),
        ["Total Expenses", data.totalExpenses.toFixed(2)],
        [""],
        ["Net Income", netIncome.toFixed(2)],
      ];
    } else if (statementType === "cashflow") {
      rows = [
        ["Cash Flow Statement", bounds.label],
        [""],
        ["Cash Inflows"],
        ["Cash Payments", data.paymentsCash.toFixed(2)],
        ["Card Payments", data.paymentsCard.toFixed(2)],
        ["Bank Transfers", data.paymentsBank.toFixed(2)],
        ["Other", data.paymentsOther.toFixed(2)],
        ["Total Inflows", data.totalPaymentsReceived.toFixed(2)],
        [""],
        ["Cash Outflows"],
        ...Object.entries(data.expensesByCategory).map(([cat, amt]) => [cat, amt.toFixed(2)]),
        ["Total Outflows", data.totalExpenses.toFixed(2)],
        [""],
        ["Net Cash Flow", (data.totalPaymentsReceived - data.totalExpenses).toFixed(2)],
      ];
    } else {
      rows = [
        ["Balance Sheet", bounds.label],
        [""],
        ["Assets"],
        ["Inventory", data.inventoryValue.toFixed(2)],
        ["Accounts Receivable", data.accountsReceivable.toFixed(2)],
        ["Total Assets", (data.inventoryValue + data.accountsReceivable).toFixed(2)],
      ];
    }

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${statementType}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "Exported", description: `${statementType.toUpperCase()} downloaded` });
  }

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Statements</h1>
            <p className="text-muted-foreground">Profit & Loss, Cash Flow, and Balance Sheet</p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last30">Last 30 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisQuarter">This Quarter</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total Revenue", value: totalRevenue, icon: DollarSign },
            { label: "Total Expenses", value: data?.totalExpenses || 0, icon: TrendingDown },
            { label: "Net Income", value: netIncome, icon: netIncome >= 0 ? TrendingUp : TrendingDown },
            { label: "Gross Margin", value: grossMargin, icon: ArrowRight, suffix: "%" },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-24" /> : (
                  <div className={`text-2xl font-bold ${item.label === "Net Income" && netIncome < 0 ? "text-destructive" : ""}`}>
                    {item.suffix ? `${item.value.toFixed(1)}${item.suffix}` : item.value.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Statements Tabs */}
        <Tabs defaultValue="pnl" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
          </TabsList>

          {/* P&L */}
          <TabsContent value="pnl">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Income Statement</CardTitle>
                  <CardDescription>{bounds.label}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV("pnl")} disabled={loading}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[300px] w-full" /> : data && (
                  <div className="max-w-lg">
                    <SectionHeader title="Revenue" />
                    <LineItem label="Invoice Sales" amount={data.invoiceRevenue} indent />
                    <LineItem label="POS Sales" amount={data.posRevenue} indent />
                    <LineItem label="Total Revenue" amount={totalRevenue} bold />

                    <SectionHeader title="Operating Expenses" />
                    {Object.entries(data.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <LineItem key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} amount={amt} indent />
                    ))}
                    {Object.keys(data.expensesByCategory).length === 0 && (
                      <div className="py-2 pl-6 text-sm text-muted-foreground">No expenses recorded</div>
                    )}
                    <LineItem label="Total Expenses" amount={data.totalExpenses} bold />

                    <div className="mt-4" />
                    <LineItem label="Net Income" amount={netIncome} bold />
                    <div className="mt-2">
                      <Badge variant={netIncome >= 0 ? "default" : "destructive"}>
                        {netIncome >= 0 ? "Profit" : "Loss"}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cashflow">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Cash Flow Statement</CardTitle>
                  <CardDescription>{bounds.label}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV("cashflow")} disabled={loading}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[300px] w-full" /> : data && (
                  <div className="max-w-lg">
                    <SectionHeader title="Cash Inflows" />
                    <LineItem label="Cash Payments" amount={data.paymentsCash} indent />
                    <LineItem label="Card Payments" amount={data.paymentsCard} indent />
                    <LineItem label="Bank Transfers" amount={data.paymentsBank} indent />
                    {data.paymentsOther > 0 && <LineItem label="Other Payments" amount={data.paymentsOther} indent />}
                    <LineItem label="Total Inflows" amount={data.totalPaymentsReceived} bold />

                    <SectionHeader title="Cash Outflows" />
                    {Object.entries(data.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <LineItem key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} amount={amt} indent />
                    ))}
                    {Object.keys(data.expensesByCategory).length === 0 && (
                      <div className="py-2 pl-6 text-sm text-muted-foreground">No outflows recorded</div>
                    )}
                    <LineItem label="Total Outflows" amount={data.totalExpenses} bold />

                    <div className="mt-4" />
                    <LineItem label="Net Cash Flow" amount={data.totalPaymentsReceived - data.totalExpenses} bold />
                    <div className="mt-2">
                      <Badge variant={(data.totalPaymentsReceived - data.totalExpenses) >= 0 ? "default" : "destructive"}>
                        {(data.totalPaymentsReceived - data.totalExpenses) >= 0 ? "Positive" : "Negative"} Cash Flow
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="balance">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Balance Sheet</CardTitle>
                  <CardDescription>As of {format(bounds.end, "MMMM d, yyyy")}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV("balance")} disabled={loading}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[300px] w-full" /> : data && (
                  <div className="max-w-lg">
                    <SectionHeader title="Current Assets" />
                    <LineItem label="Inventory (at cost)" amount={data.inventoryValue} indent />
                    <LineItem label="Accounts Receivable" amount={data.accountsReceivable} indent />
                    <LineItem label="Total Assets" amount={data.inventoryValue + data.accountsReceivable} bold />

                    <SectionHeader title="Equity" />
                    <LineItem label="Retained Earnings (Period)" amount={netIncome} indent />
                    <LineItem label="Total Equity" amount={netIncome} bold />

                    <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <strong>Note:</strong> This is a simplified balance sheet based on available system data. 
                      It includes inventory valuation and outstanding receivables. For a complete balance sheet, 
                      consult with your accountant.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
}
