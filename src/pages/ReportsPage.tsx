import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Receipt,
  Package,
  FileSpreadsheet,
} from "lucide-react";
import {
  getPayments,
  getInvoices,
  getPOSSales,
  getProducts,
  type Payment,
  type Invoice,
  type POSSale,
  type Product,
} from "@/lib/supabase-db";

type DateRange = "7days" | "30days" | "thisMonth" | "lastMonth";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function ReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30days");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [posSales, setPosSales] = useState<POSSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [paymentsData, invoicesData, posSalesData, productsData] = await Promise.all([
        getPayments(),
        getInvoices(),
        getPOSSales(),
        getProducts(),
      ]);
      setPayments(paymentsData);
      setInvoices(invoicesData);
      setPosSales(posSalesData);
      setProducts(productsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Date range calculations
  const getDateRangeBounds = () => {
    const now = new Date();
    switch (dateRange) {
      case "7days":
        return { start: subDays(now, 7), end: now };
      case "30days":
        return { start: subDays(now, 30), end: now };
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth":
        const lastMonth = subDays(startOfMonth(now), 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const { start, end } = getDateRangeBounds();

  // Filter data by date range
  const filteredPayments = payments.filter(p => {
    const date = new Date(p.created_at);
    return date >= start && date <= end;
  });

  const filteredInvoices = invoices.filter(i => {
    const date = new Date(i.created_at);
    return date >= start && date <= end;
  });

  const filteredPosSales = posSales.filter(s => {
    const date = new Date(s.created_at);
    return date >= start && date <= end;
  });

  // Calculate metrics
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalInvoices = filteredInvoices.length;
  const totalPosSales = filteredPosSales.length;
  const avgOrderValue = (totalInvoices + totalPosSales) > 0
    ? totalRevenue / (totalInvoices + totalPosSales)
    : 0;

  // Previous period comparison
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = subDays(start, daysDiff);
  const prevEnd = subDays(end, daysDiff);

  const prevPayments = payments.filter(p => {
    const date = new Date(p.created_at);
    return date >= prevStart && date <= prevEnd;
  });

  const prevRevenue = prevPayments.reduce((sum, p) => sum + p.amount, 0);
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  // Daily revenue chart data
  const dailyRevenueData = eachDayOfInterval({ start, end }).map(day => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayPayments = filteredPayments.filter(p =>
      format(new Date(p.created_at), "yyyy-MM-dd") === dayStr
    );
    return {
      date: format(day, "MMM d"),
      revenue: dayPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  });

  // Payment methods distribution
  const paymentMethodData = Object.entries(
    filteredPayments.reduce((acc, p) => {
      const method = p.payment_method || "other";
      acc[method] = (acc[method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
    value,
  }));

  // Invoice status distribution
  const invoiceStatusData = Object.entries(
    filteredInvoices.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Top products by stock value
  const topProducts = [...products]
    .map(p => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name,
      value: p.stock_quantity * p.unit_price,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Export functions
  function exportToCSV(data: Record<string, unknown>[], filename: string) {
    if (data.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast({ title: "Export successful", description: `${filename}.csv downloaded` });
  }

  function exportPayments() {
    const data = filteredPayments.map(p => ({
      payment_number: p.payment_number,
      amount: p.amount,
      payment_method: p.payment_method,
      reference: p.reference || "",
      date: format(new Date(p.created_at), "yyyy-MM-dd"),
    }));
    exportToCSV(data, "payments_report");
  }

  function exportInvoices() {
    const data = filteredInvoices.map(i => ({
      invoice_number: i.invoice_number,
      customer_name: i.customer_name,
      subtotal: i.subtotal,
      tax_total: i.tax_total,
      total: i.total,
      amount_paid: i.amount_paid,
      status: i.status,
      date: format(new Date(i.created_at), "yyyy-MM-dd"),
    }));
    exportToCSV(data, "invoices_report");
  }

  function exportSalesReport() {
    const data = filteredPosSales.map(s => ({
      sale_number: s.sale_number,
      customer_name: s.customer_name || "Walk-in",
      subtotal: s.subtotal,
      tax_total: s.tax_total,
      total: s.total,
      payment_method: s.payment_method,
      date: format(new Date(s.created_at), "yyyy-MM-dd"),
    }));
    exportToCSV(data, "pos_sales_report");
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">Sales analytics and business insights</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                  <p className={`text-xs flex items-center gap-1 ${revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(revenueChange).toFixed(1)}% from previous period
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalInvoices}</div>
                  <p className="text-xs text-muted-foreground">
                    Total invoices created
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">POS Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalPosSales}</div>
                  <p className="text-xs text-muted-foreground">
                    Point of sale transactions
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Per transaction
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue Over Time */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
              <CardDescription>Daily revenue for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="font-medium">{payload[0].payload.date}</div>
                              <div className="text-sm text-muted-foreground">
                                Revenue: ${(payload[0].value as number).toFixed(2)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Revenue by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : paymentMethodData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No payment data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentMethodData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Invoice Status */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Status</CardTitle>
              <CardDescription>Distribution by status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : invoiceStatusData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No invoice data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={invoiceStatusData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Products & Export */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top Products by Stock Value */}
          <Card>
            <CardHeader>
              <CardTitle>Top Products by Stock Value</CardTitle>
              <CardDescription>Inventory value ranking</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : topProducts.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No product data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardHeader>
              <CardTitle>Export Reports</CardTitle>
              <CardDescription>Download data as CSV files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={exportPayments}
                disabled={loading}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Payments Report
                <Download className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={exportInvoices}
                disabled={loading}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Invoices Report
                <Download className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={exportSalesReport}
                disabled={loading}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export POS Sales Report
                <Download className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AppLayout>
  );
}
