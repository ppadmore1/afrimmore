import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Users, 
  DollarSign, 
  TrendingUp,
  Plus,
  ArrowUpRight,
  Clock,
  Package,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  getInvoices, 
  getCustomers, 
  getPayments,
  getProducts,
  getPOSSales,
  type Invoice,
  type Customer,
  type Payment,
  type Product,
  type POSSale,
} from "@/lib/supabase-db";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [posSales, setPosSales] = useState<POSSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [inv, cust, pay, prod, sales] = await Promise.all([
          getInvoices(),
          getCustomers(),
          getPayments(),
          getProducts(),
          getPOSSales(),
        ]);
        setInvoices(inv);
        setCustomers(cust);
        setPayments(pay);
        setProducts(prod);
        setPosSales(sales);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate metrics
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingInvoicesList = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled');
  const outstandingAmount = pendingInvoicesList.reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0);
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = pendingInvoicesList.length;

  // Today's sales
  const today = new Date().toDateString();
  const todayPosSales = posSales.filter(s => new Date(s.created_at).toDateString() === today);
  const todaySalesTotal = todayPosSales.reduce((sum, s) => sum + s.total, 0);

  // Low stock products
  const lowStockProducts = products.filter(p => 
    p.stock_quantity <= (p.low_stock_threshold || 10)
  ).sort((a, b) => a.stock_quantity - b.stock_quantity);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    paid: { variant: "default", label: "Paid" },
    pending: { variant: "secondary", label: "Pending" },
    draft: { variant: "outline", label: "Draft" },
    approved: { variant: "default", label: "Approved" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };

  return (
    <AppLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your business overview.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/pos">
              <Button variant="outline" className="gap-2">
                <ShoppingCart className="w-4 h-4" />
                POS
              </Button>
            </Link>
            <Link to="/invoices/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Invoice
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  <div className="text-2xl font-bold">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    From {payments.length} payments
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">${todaySalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground">
                    {todayPosSales.length} transactions today
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-orange-600">${outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground">
                    {pendingInvoices} pending invoices
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${lowStockProducts.length > 0 ? 'text-red-600' : ''}`}>
                    {lowStockProducts.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Products need restocking
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Invoices */}
          <motion.div variants={item}>
            <Card className="h-full">
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
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : recentInvoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No invoices yet</p>
                    <Link to="/invoices/new">
                      <Button size="sm" className="mt-3">Create Invoice</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentInvoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        to={`/invoices/${invoice.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground truncate">{invoice.customer_name}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium">${invoice.total.toFixed(2)}</p>
                          <Badge variant={statusConfig[invoice.status]?.variant || "outline"} className="text-xs">
                            {statusConfig[invoice.status]?.label || invoice.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Low Stock Alerts */}
          <motion.div variants={item}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
                <Link to="/inventory">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View inventory
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : lowStockProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-green-500 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">All products are well-stocked</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lowStockProducts.slice(0, 5).map((product) => {
                      const threshold = product.low_stock_threshold || 10;
                      const percentage = Math.min((product.stock_quantity / threshold) * 100, 100);
                      const isOutOfStock = product.stock_quantity === 0;
                      
                      return (
                        <div key={product.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isOutOfStock && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-medium text-sm truncate max-w-[180px]">
                                {product.name}
                              </span>
                            </div>
                            <span className={`text-sm font-medium ${isOutOfStock ? 'text-red-600' : 'text-orange-600'}`}>
                              {product.stock_quantity} left
                            </span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className={`h-2 ${isOutOfStock ? '[&>div]:bg-red-500' : '[&>div]:bg-orange-500'}`}
                          />
                        </div>
                      );
                    })}
                    {lowStockProducts.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        +{lowStockProducts.length - 5} more items
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Pending Invoices */}
        {pendingInvoicesList.length > 0 && (
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Pending Invoices ({pendingInvoicesList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingInvoicesList.slice(0, 6).map((invoice) => (
                    <Link
                      key={invoice.id}
                      to={`/invoices/${invoice.id}`}
                      className="p-4 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{invoice.invoice_number}</span>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-2">{invoice.customer_name}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-orange-600">${(invoice.total - invoice.amount_paid).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(invoice.created_at), "MMM d")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-4">
          <Link to="/invoices/new">
            <Card className="cursor-pointer hover:shadow-md transition-all group h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">New Invoice</h3>
                  <p className="text-xs text-muted-foreground">Create invoice</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/quotations/new">
            <Card className="cursor-pointer hover:shadow-md transition-all group h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">New Quotation</h3>
                  <p className="text-xs text-muted-foreground">Create quote</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/customers/new">
            <Card className="cursor-pointer hover:shadow-md transition-all group h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Add Customer</h3>
                  <p className="text-xs text-muted-foreground">New customer</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/products/new">
            <Card className="cursor-pointer hover:shadow-md transition-all group h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Add Product</h3>
                  <p className="text-xs text-muted-foreground">New product</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
