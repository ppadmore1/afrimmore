import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, FileText, Receipt, Package, TrendingUp, 
  Users, DollarSign, AlertTriangle, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/contexts/BranchContext';
import { useNavigate } from 'react-router-dom';

interface BranchStats {
  branch_id: string;
  branch_name: string;
  invoice_count: number;
  invoice_total: number;
  receipt_count: number;
  receipt_total: number;
  pos_count: number;
  pos_total: number;
  po_count: number;
}

interface DocumentActivity {
  id: string;
  type: 'invoice' | 'quotation' | 'receipt' | 'delivery_note' | 'pos_sale';
  number: string;
  customer: string;
  amount: number;
  date: string;
  branch_name: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { branches, isAdmin } = useBranch();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<DocumentActivity[]>([]);
  const [totals, setTotals] = useState({
    invoices: 0,
    invoiceAmount: 0,
    receipts: 0,
    receiptAmount: 0,
    pos: 0,
    posAmount: 0,
    quotations: 0,
    deliveryNotes: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin, dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return subDays(now, 7).toISOString();
      case 'month':
        return startOfMonth(now).toISOString();
      case 'quarter':
        return subDays(now, 90).toISOString();
      default:
        return startOfMonth(now).toISOString();
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Fetch invoices with branch info
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_name, total, created_at')
        .gte('created_at', dateFilter);

      // Fetch POS sales with branch info
      const { data: posSales } = await supabase
        .from('pos_sales')
        .select('id, sale_number, customer_name, total, created_at, branch_id, branches(name)')
        .gte('created_at', dateFilter);

      // Fetch quotations
      const { data: quotations } = await supabase
        .from('quotations')
        .select('id')
        .gte('created_at', dateFilter);

      // Fetch delivery notes
      const { data: deliveryNotes } = await supabase
        .from('delivery_notes')
        .select('id')
        .gte('created_at', dateFilter);

      // Fetch receipts
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, receipt_number, customer_name, total, created_at, branch_id')
        .gte('created_at', dateFilter);

      // Low stock products
      const { data: lowStock } = await supabase
        .from('products')
        .select('id')
        .filter('stock_quantity', 'lte', 10)
        .eq('is_active', true);

      // Calculate totals
      const invoiceTotal = invoices?.reduce((sum, i) => sum + Number(i.total), 0) || 0;
      const receiptTotal = receipts?.reduce((sum, r) => sum + Number(r.total), 0) || 0;
      const posTotal = posSales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;

      setTotals({
        invoices: invoices?.length || 0,
        invoiceAmount: invoiceTotal,
        receipts: receipts?.length || 0,
        receiptAmount: receiptTotal,
        pos: posSales?.length || 0,
        posAmount: posTotal,
        quotations: quotations?.length || 0,
        deliveryNotes: deliveryNotes?.length || 0,
        lowStockCount: lowStock?.length || 0,
      });

      // Calculate branch stats
      const statsMap = new Map<string, BranchStats>();
      branches.forEach(branch => {
        statsMap.set(branch.id, {
          branch_id: branch.id,
          branch_name: branch.name,
          invoice_count: 0,
          invoice_total: 0,
          receipt_count: 0,
          receipt_total: 0,
          pos_count: 0,
          pos_total: 0,
          po_count: 0,
        });
      });

      posSales?.forEach(sale => {
        if (sale.branch_id && statsMap.has(sale.branch_id)) {
          const stat = statsMap.get(sale.branch_id)!;
          stat.pos_count++;
          stat.pos_total += Number(sale.total);
        }
      });

      receipts?.forEach(receipt => {
        if (receipt.branch_id && statsMap.has(receipt.branch_id)) {
          const stat = statsMap.get(receipt.branch_id)!;
          stat.receipt_count++;
          stat.receipt_total += Number(receipt.total);
        }
      });

      setBranchStats(Array.from(statsMap.values()).filter(s => s.pos_count > 0 || s.receipt_count > 0));

      // Build recent activity
      const activity: DocumentActivity[] = [];
      
      invoices?.slice(0, 5).forEach(inv => {
        activity.push({
          id: inv.id,
          type: 'invoice',
          number: inv.invoice_number,
          customer: inv.customer_name,
          amount: Number(inv.total),
          date: inv.created_at,
          branch_name: 'HQ',
        });
      });

      posSales?.slice(0, 5).forEach(sale => {
        activity.push({
          id: sale.id,
          type: 'pos_sale',
          number: sale.sale_number,
          customer: sale.customer_name || 'Walk-in',
          amount: Number(sale.total),
          date: sale.created_at,
          branch_name: (sale.branches as any)?.name || 'Unknown',
        });
      });

      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentActivity(activity.slice(0, 10));

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = branchStats.map(stat => ({
    name: stat.branch_name.substring(0, 10),
    sales: stat.pos_total + stat.receipt_total,
    transactions: stat.pos_count + stat.receipt_count,
  }));

  const pieData = [
    { name: 'POS Sales', value: totals.posAmount },
    { name: 'Receipts', value: totals.receiptAmount },
    { name: 'Invoices', value: totals.invoiceAmount },
  ].filter(d => d.value > 0);

  const getTypeBadge = (type: string) => {
    const config: Record<string, { className: string; label: string }> = {
      invoice: { className: 'bg-blue-100 text-blue-800', label: 'Invoice' },
      quotation: { className: 'bg-purple-100 text-purple-800', label: 'Quote' },
      receipt: { className: 'bg-green-100 text-green-800', label: 'Receipt' },
      delivery_note: { className: 'bg-orange-100 text-orange-800', label: 'Delivery' },
      pos_sale: { className: 'bg-emerald-100 text-emerald-800', label: 'POS' },
    };
    const { className, label } = config[type] || { className: 'bg-muted', label: type };
    return <Badge className={className}>{label}</Badge>;
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all branches and documents
            </p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Revenue</CardDescription>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(totals.invoiceAmount + totals.receiptAmount + totals.posAmount).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.invoices + totals.receipts + totals.pos} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Active Branches</CardDescription>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {branchStats.length} with activity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Documents Created</CardDescription>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totals.invoices + totals.quotations + totals.deliveryNotes + totals.receipts}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                + {totals.pos} POS sales
              </p>
            </CardContent>
          </Card>

          <Card className={totals.lowStockCount > 0 ? 'border-orange-500' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Low Stock Items</CardDescription>
              <AlertTriangle className={`w-4 h-4 ${totals.lowStockCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.lowStockCount}</div>
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs"
                onClick={() => navigate('/inventory')}
              >
                View inventory →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Branch</CardTitle>
              <CardDescription>Revenue comparison across branches</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="sales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No branch data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Distribution</CardTitle>
              <CardDescription>By document type</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Branch Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Branch Performance</CardTitle>
            <CardDescription>Detailed breakdown by branch</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">POS Sales</TableHead>
                  <TableHead className="text-right">POS Revenue</TableHead>
                  <TableHead className="text-right">Receipts</TableHead>
                  <TableHead className="text-right">Receipt Revenue</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No branch activity in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  branchStats.map((stat) => (
                    <TableRow key={stat.branch_id}>
                      <TableCell className="font-medium">{stat.branch_name}</TableCell>
                      <TableCell className="text-right">{stat.pos_count}</TableCell>
                      <TableCell className="text-right">${stat.pos_total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{stat.receipt_count}</TableCell>
                      <TableCell className="text-right">${stat.receipt_total.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">
                        ${(stat.pos_total + stat.receipt_total).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest documents across all branches</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Document #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No recent activity
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivity.map((activity) => (
                    <TableRow key={`${activity.type}-${activity.id}`}>
                      <TableCell>{getTypeBadge(activity.type)}</TableCell>
                      <TableCell className="font-medium">{activity.number}</TableCell>
                      <TableCell>{activity.customer}</TableCell>
                      <TableCell>{activity.branch_name}</TableCell>
                      <TableCell className="text-right">${activity.amount.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(activity.date), 'MMM d, HH:mm')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
