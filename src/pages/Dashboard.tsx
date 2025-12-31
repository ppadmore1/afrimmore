import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Users, 
  DollarSign, 
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Package,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  getAllInvoices, 
  getAllCustomers, 
  getAllPayments,
  Invoice,
  Customer,
  Payment,
} from "@/lib/db";
import { format } from "date-fns";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [inv, cust, pay] = await Promise.all([
          getAllInvoices(),
          getAllCustomers(),
          getAllPayments(),
        ]);
        setInvoices(inv);
        setCustomers(cust);
        setPayments(pay);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingAmount = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled').length;

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statusConfig: Record<string, { variant: "success" | "warning" | "info" | "muted" | "destructive"; label: string }> = {
    paid: { variant: "success", label: "Paid" },
    partial: { variant: "warning", label: "Partial" },
    sent: { variant: "info", label: "Sent" },
    draft: { variant: "muted", label: "Draft" },
    overdue: { variant: "destructive", label: "Overdue" },
    cancelled: { variant: "muted", label: "Cancelled" },
  };

  return (
    <AppLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
          </div>
          <Link to="/invoices/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Invoice
            </Button>
          </Link>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-success" />
                From {payments.length} payments
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Outstanding
              </CardTitle>
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">${outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingInvoices} pending invoices
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoices
              </CardTitle>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {paidInvoices} paid, {pendingInvoices} pending
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Customers
              </CardTitle>
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active customers
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Invoices */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Invoices</CardTitle>
              <Link to="/invoices">
                <Button variant="ghost" size="sm" className="gap-1">
                  View all
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4">
                      <div className="h-12 w-12 bg-muted rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/4" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                      <div className="h-6 w-16 bg-muted rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No invoices yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first invoice to get started</p>
                  <Link to="/invoices/new">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Invoice
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentInvoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      to={`/invoices/${invoice.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {invoice.customerName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium font-mono text-foreground">
                          ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge variant={statusConfig[invoice.status]?.variant || "muted"}>
                          {statusConfig[invoice.status]?.label || invoice.status}
                        </Badge>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-3">
          <Link to="/invoices/new">
            <Card className="cursor-pointer hover:shadow-lg transition-all group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">New Invoice</h3>
                  <p className="text-sm text-muted-foreground">Create a new invoice</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/customers/new">
            <Card className="cursor-pointer hover:shadow-lg transition-all group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-info flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-info-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Add Customer</h3>
                  <p className="text-sm text-muted-foreground">Register a new customer</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/products/new">
            <Card className="cursor-pointer hover:shadow-lg transition-all group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6 text-success-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Add Product</h3>
                  <p className="text-sm text-muted-foreground">Add product or service</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
