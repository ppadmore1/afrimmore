import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Printer,
  Building2,
  Calendar,
  PieChart,
  BarChart3,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type Period = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "last30" | "lastYear";

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
    case "lastYear": {
      const ly = new Date(now.getFullYear() - 1, 0, 1);
      return { start: startOfYear(ly), end: endOfYear(ly), label: `FY ${now.getFullYear() - 1}` };
    }
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

interface Branch {
  id: string;
  name: string;
  code: string;
}

function computeFinancials(
  invoices: any[],
  posSales: any[],
  payments: any[],
  expenses: any[],
  products: any[],
  productBranches: any[] | null,
  branchId: string | null
): FinancialData {
  const invoiceRevenue = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const posRevenue = posSales.reduce((s, p) => s + Number(p.total || 0), 0);
  const accountsReceivable = invoices
    .filter(i => i.status !== "paid")
    .reduce((s, i) => s + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

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

  let inventoryValue = 0;
  if (branchId && productBranches) {
    inventoryValue = productBranches.reduce((s, pb) => {
      const product = products.find((p: any) => p.id === pb.product_id);
      const costPrice = product ? Number(product.cost_price || product.unit_price || 0) : 0;
      return s + (Number(pb.stock_quantity || 0) * costPrice);
    }, 0);
  } else {
    inventoryValue = products.reduce((s, p) => s + (Number(p.stock_quantity || 0) * Number(p.cost_price || p.unit_price || 0)), 0);
  }

  return { invoiceRevenue, posRevenue, paymentsCash, paymentsBank, paymentsCard, paymentsOther, totalExpenses, expensesByCategory, inventoryValue, accountsReceivable, totalPaymentsReceived };
}

function fmtCurrency(amount: number) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ─── QuickBooks-style line items ─────────────────────────────────
function StatementTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-6 print:mb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-4 pb-1">
      <span className="text-sm font-bold text-foreground uppercase tracking-wide">{children}</span>
    </div>
  );
}

function SubSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 pb-1 pl-4">
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

function LineRow({ label, amount, indent = 0, bold, isTotal, isGrandTotal, className }: {
  label: string;
  amount: number;
  indent?: number;
  bold?: boolean;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${isGrandTotal ? "border-t-2 border-b-2 border-foreground/20 mt-2 py-2" : isTotal ? "border-t border-foreground/10" : ""} ${className || ""}`}
      style={{ paddingLeft: `${indent * 20 + 16}px`, paddingRight: 16 }}
    >
      <span className={`text-sm ${bold || isTotal || isGrandTotal ? "font-semibold" : ""} text-foreground`}>
        {label}
      </span>
      <span className={`text-sm font-mono tabular-nums ${bold || isTotal || isGrandTotal ? "font-bold" : ""} ${amount < 0 ? "text-destructive" : "text-foreground"}`}>
        {amount < 0 ? `(${fmtCurrency(Math.abs(amount))})` : fmtCurrency(amount)}
      </span>
    </div>
  );
}

function EmptyRow() {
  return <div className="h-3" />;
}

// ─── KPI Card ─────────────────────────────────────
function KpiCard({ label, value, subtitle, icon: Icon, trend }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <div className="flex items-center gap-1 mt-1">
                {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3 text-destructive" />}
                <p className={`text-xs ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                  {subtitle}
                </p>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancialStatementsPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState("pnl");

  const bounds = useMemo(() => getPeriodBounds(period), [period]);

  useEffect(() => {
    supabase.from("branches").select("id, name, code").eq("is_active", true).order("name").then(({ data }) => {
      setBranches(data || []);
    });
  }, []);

  useEffect(() => {
    loadFinancialData();
  }, [period, branchFilter]);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const startStr = bounds.start.toISOString();
      const endStr = bounds.end.toISOString();
      const startDate = format(bounds.start, "yyyy-MM-dd");
      const endDate = format(bounds.end, "yyyy-MM-dd");
      const isBranch = branchFilter !== "all";

      let invoicesQ = supabase.from("invoices").select("total, amount_paid, status").gte("created_at", startStr).lte("created_at", endStr);
      let posQ = supabase.from("pos_sales").select("total, branch_id").gte("created_at", startStr).lte("created_at", endStr);
      let paymentsQ = supabase.from("payments").select("amount, payment_method, pos_sale_id").gte("created_at", startStr).lte("created_at", endStr);
      let expensesQ = supabase.from("expenses").select("amount, category, branch_id").gte("expense_date", startDate).lte("expense_date", endDate);
      let productsQ = supabase.from("products").select("id, stock_quantity, unit_price, cost_price");

      if (isBranch) {
        posQ = posQ.eq("branch_id", branchFilter);
        expensesQ = expensesQ.eq("branch_id", branchFilter);
      }

      const queries: Promise<any>[] = [
        invoicesQ.then() as Promise<any>,
        posQ.then() as Promise<any>,
        paymentsQ.then() as Promise<any>,
        expensesQ.then() as Promise<any>,
        productsQ.then() as Promise<any>,
      ];

      if (isBranch) {
        queries.push(
          supabase.from("product_branches").select("product_id, stock_quantity").eq("branch_id", branchFilter).then() as Promise<any>
        );
      }

      const results = await Promise.all(queries);
      const invoices = results[0].data || [];
      const posSales = results[1].data || [];
      const payments = results[2].data || [];
      const expenses = results[3].data || [];
      const products = results[4].data || [];
      const productBranches = isBranch ? (results[5]?.data || []) : null;

      setData(computeFinancials(invoices, posSales, payments, expenses, products, productBranches, isBranch ? branchFilter : null));
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = (data?.invoiceRevenue || 0) + (data?.posRevenue || 0);
  const costOfGoodsSold = data?.totalExpenses ? data.totalExpenses * 0.6 : 0; // Estimate COGS
  const grossProfit = totalRevenue - costOfGoodsSold;
  const operatingExpenses = data?.totalExpenses ? data.totalExpenses * 0.4 : 0;
  const netIncome = totalRevenue - (data?.totalExpenses || 0);
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;
  const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue * 100) : 0;
  const netCashFlow = (data?.totalPaymentsReceived || 0) - (data?.totalExpenses || 0);
  const totalAssets = (data?.inventoryValue || 0) + (data?.accountsReceivable || 0);

  const branchLabel = branchFilter === "all" ? "All Branches" : branches.find(b => b.id === branchFilter)?.name || "Branch";
  const companyName = branchFilter === "all" ? "POSFlow Business" : branchLabel;

  function handlePrint() {
    window.print();
  }

  function exportCSV(statementType: string) {
    if (!data) return;
    let rows: string[][] = [];

    if (statementType === "pnl") {
      rows = [
        [companyName],
        ["Income Statement"],
        [`For the period: ${format(bounds.start, "MMM d, yyyy")} to ${format(bounds.end, "MMM d, yyyy")}`],
        [""],
        ["INCOME"],
        ["Invoice Sales", "", data.invoiceRevenue.toFixed(2)],
        ["POS Sales", "", data.posRevenue.toFixed(2)],
        ["Total Income", "", totalRevenue.toFixed(2)],
        [""],
        ["COST OF GOODS SOLD"],
        ["Estimated COGS", "", costOfGoodsSold.toFixed(2)],
        ["Total COGS", "", costOfGoodsSold.toFixed(2)],
        [""],
        ["GROSS PROFIT", "", grossProfit.toFixed(2)],
        [""],
        ["OPERATING EXPENSES"],
        ...Object.entries(data.expensesByCategory).map(([cat, amt]) => [cat.charAt(0).toUpperCase() + cat.slice(1), "", amt.toFixed(2)]),
        ["Total Operating Expenses", "", operatingExpenses.toFixed(2)],
        [""],
        ["NET INCOME", "", netIncome.toFixed(2)],
      ];
    } else if (statementType === "cashflow") {
      rows = [
        [companyName],
        ["Statement of Cash Flows"],
        [`For the period: ${format(bounds.start, "MMM d, yyyy")} to ${format(bounds.end, "MMM d, yyyy")}`],
        [""],
        ["OPERATING ACTIVITIES"],
        ["Cash received from customers"],
        ["Cash Payments", "", data.paymentsCash.toFixed(2)],
        ["Card Payments", "", data.paymentsCard.toFixed(2)],
        ["Bank Transfers", "", data.paymentsBank.toFixed(2)],
        ["Other Payments", "", data.paymentsOther.toFixed(2)],
        ["Total Cash Received", "", data.totalPaymentsReceived.toFixed(2)],
        [""],
        ["Cash paid for expenses"],
        ...Object.entries(data.expensesByCategory).map(([cat, amt]) => [cat, "", `-${amt.toFixed(2)}`]),
        ["Total Cash Paid", "", `-${data.totalExpenses.toFixed(2)}`],
        [""],
        ["Net Cash from Operating Activities", "", netCashFlow.toFixed(2)],
      ];
    } else {
      rows = [
        [companyName],
        ["Balance Sheet"],
        [`As of ${format(bounds.end, "MMMM d, yyyy")}`],
        [""],
        ["ASSETS"],
        ["Current Assets"],
        ["Inventory (at cost)", "", data.inventoryValue.toFixed(2)],
        ["Accounts Receivable", "", data.accountsReceivable.toFixed(2)],
        ["Total Current Assets", "", totalAssets.toFixed(2)],
        [""],
        ["TOTAL ASSETS", "", totalAssets.toFixed(2)],
        [""],
        ["EQUITY"],
        ["Retained Earnings", "", netIncome.toFixed(2)],
        ["TOTAL EQUITY", "", netIncome.toFixed(2)],
      ];
    }

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const branchSuffix = branchFilter === "all" ? "all_branches" : branchLabel.replace(/\s+/g, "_").toLowerCase();
    link.download = `${statementType}_${branchSuffix}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "Exported", description: `Report downloaded successfully` });
  }

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Statements</h1>
              <p className="text-muted-foreground mt-1">Comprehensive financial reports for your business</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(activeTab)} disabled={loading} className="print:hidden">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border print:hidden">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-[160px] h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last30">Last 30 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="thisQuarter">This Quarter</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="lastYear">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px] h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {branchFilter !== "all" && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <Badge variant="secondary" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {branchLabel}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* KPI Dashboard Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:hidden">
          <KpiCard
            label="Total Revenue"
            value={fmtCurrency(totalRevenue)}
            subtitle={`${grossMargin.toFixed(1)}% gross margin`}
            icon={DollarSign}
            trend={totalRevenue > 0 ? "up" : "neutral"}
          />
          <KpiCard
            label="Net Income"
            value={fmtCurrency(netIncome)}
            subtitle={`${netMargin.toFixed(1)}% net margin`}
            icon={netIncome >= 0 ? TrendingUp : TrendingDown}
            trend={netIncome >= 0 ? "up" : "down"}
          />
          <KpiCard
            label="Cash Flow"
            value={fmtCurrency(netCashFlow)}
            subtitle={netCashFlow >= 0 ? "Positive flow" : "Negative flow"}
            icon={Wallet}
            trend={netCashFlow >= 0 ? "up" : "down"}
          />
          <KpiCard
            label="Total Assets"
            value={fmtCurrency(totalAssets)}
            subtitle={`${fmtCurrency(data?.accountsReceivable || 0)} receivable`}
            icon={PieChart}
            trend="neutral"
          />
        </div>

        {/* Statements */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="print:hidden bg-muted/50">
            <TabsTrigger value="pnl" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Profit & Loss
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-2">
              <Wallet className="h-4 w-4" /> Cash Flow
            </TabsTrigger>
            <TabsTrigger value="balance" className="gap-2">
              <Receipt className="h-4 w-4" /> Balance Sheet
            </TabsTrigger>
          </TabsList>

          {/* ═══ PROFIT & LOSS ═══ */}
          <TabsContent value="pnl">
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6 lg:p-8">
                {loading ? <Skeleton className="h-[400px] w-full" /> : data && (
                  <div className="max-w-2xl mx-auto">
                    <StatementTitle
                      title="Income Statement"
                      subtitle={`${companyName} — ${format(bounds.start, "MMM d, yyyy")} to ${format(bounds.end, "MMM d, yyyy")}`}
                    />

                    <SectionLabel>Income</SectionLabel>
                    <LineRow label="Invoice Sales" amount={data.invoiceRevenue} indent={1} />
                    <LineRow label="POS Sales" amount={data.posRevenue} indent={1} />
                    <LineRow label="Total Income" amount={totalRevenue} isTotal bold />

                    <EmptyRow />
                    <SectionLabel>Cost of Goods Sold</SectionLabel>
                    <LineRow label="Estimated COGS" amount={costOfGoodsSold} indent={1} />
                    <LineRow label="Total COGS" amount={costOfGoodsSold} isTotal bold />

                    <EmptyRow />
                    <LineRow label="Gross Profit" amount={grossProfit} bold className="bg-muted/30 rounded" />
                    <div className="pl-4 py-1">
                      <span className="text-xs text-muted-foreground">Gross Margin: {grossMargin.toFixed(1)}%</span>
                    </div>

                    <EmptyRow />
                    <SectionLabel>Operating Expenses</SectionLabel>
                    {Object.entries(data.expensesByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
                        <LineRow key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} amount={amt} indent={1} />
                      ))}
                    {Object.keys(data.expensesByCategory).length === 0 && (
                      <div className="py-2 pl-8 text-sm text-muted-foreground italic">No expenses recorded</div>
                    )}
                    <LineRow label="Total Operating Expenses" amount={data.totalExpenses} isTotal bold />

                    <EmptyRow />
                    <LineRow label="Net Operating Income" amount={netIncome} isGrandTotal bold />
                    <div className="flex items-center gap-2 mt-3 pl-4">
                      <Badge variant={netIncome >= 0 ? "default" : "destructive"} className="text-xs">
                        {netIncome >= 0 ? "Net Profit" : "Net Loss"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Net Margin: {netMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ CASH FLOW ═══ */}
          <TabsContent value="cashflow">
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6 lg:p-8">
                {loading ? <Skeleton className="h-[400px] w-full" /> : data && (
                  <div className="max-w-2xl mx-auto">
                    <StatementTitle
                      title="Statement of Cash Flows"
                      subtitle={`${companyName} — ${format(bounds.start, "MMM d, yyyy")} to ${format(bounds.end, "MMM d, yyyy")}`}
                    />

                    <SectionLabel>Cash Flows from Operating Activities</SectionLabel>
                    <SubSectionLabel>Cash received from customers</SubSectionLabel>
                    <LineRow label="Cash Payments" amount={data.paymentsCash} indent={2} />
                    <LineRow label="Card Payments" amount={data.paymentsCard} indent={2} />
                    <LineRow label="Bank Transfers" amount={data.paymentsBank} indent={2} />
                    {data.paymentsOther > 0 && (
                      <LineRow label="Other Payments" amount={data.paymentsOther} indent={2} />
                    )}
                    <LineRow label="Total Cash Received" amount={data.totalPaymentsReceived} isTotal bold />

                    <EmptyRow />
                    <SubSectionLabel>Cash paid for operating expenses</SubSectionLabel>
                    {Object.entries(data.expensesByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
                        <LineRow key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} amount={-amt} indent={2} />
                      ))}
                    {Object.keys(data.expensesByCategory).length === 0 && (
                      <div className="py-2 pl-12 text-sm text-muted-foreground italic">No outflows recorded</div>
                    )}
                    <LineRow label="Total Cash Paid" amount={-data.totalExpenses} isTotal bold />

                    <EmptyRow />
                    <LineRow label="Net Cash from Operating Activities" amount={netCashFlow} isGrandTotal bold />
                    <div className="flex items-center gap-2 mt-3 pl-4">
                      <Badge variant={netCashFlow >= 0 ? "default" : "destructive"} className="text-xs">
                        {netCashFlow >= 0 ? "Positive" : "Negative"} Cash Flow
                      </Badge>
                    </div>

                    <EmptyRow />
                    <div className="p-4 rounded-lg bg-muted/30 border border-border mt-4">
                      <p className="text-xs font-semibold text-foreground mb-2">Cash Position Summary</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Total Inflows:</span>
                          <span className="font-mono ml-2 text-foreground">{fmtCurrency(data.totalPaymentsReceived)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Outflows:</span>
                          <span className="font-mono ml-2 text-destructive">{fmtCurrency(data.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ BALANCE SHEET ═══ */}
          <TabsContent value="balance">
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6 lg:p-8">
                {loading ? <Skeleton className="h-[400px] w-full" /> : data && (
                  <div className="max-w-2xl mx-auto">
                    <StatementTitle
                      title="Balance Sheet"
                      subtitle={`${companyName} — As of ${format(bounds.end, "MMMM d, yyyy")}`}
                    />

                    <SectionLabel>Assets</SectionLabel>
                    <SubSectionLabel>Current Assets</SubSectionLabel>
                    <LineRow label="Inventory (at cost)" amount={data.inventoryValue} indent={2} />
                    <LineRow label="Accounts Receivable" amount={data.accountsReceivable} indent={2} />
                    <LineRow label="Total Current Assets" amount={totalAssets} isTotal bold />

                    <EmptyRow />
                    <LineRow label="TOTAL ASSETS" amount={totalAssets} isGrandTotal bold />

                    <EmptyRow />
                    <SectionLabel>Liabilities & Equity</SectionLabel>
                    <SubSectionLabel>Equity</SubSectionLabel>
                    <LineRow label="Retained Earnings (Period)" amount={netIncome} indent={2} />
                    <LineRow label="Total Equity" amount={netIncome} isTotal bold />

                    <EmptyRow />
                    <LineRow label="TOTAL LIABILITIES & EQUITY" amount={netIncome} isGrandTotal bold />

                    <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> This is a simplified balance sheet based on available system data.
                        It includes inventory valuation at cost and outstanding receivables. Consult with your
                        accountant for a complete, GAAP-compliant balance sheet including all asset classes,
                        liabilities, and equity accounts.
                      </p>
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
