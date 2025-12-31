import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  Download,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  getAllInvoices, 
  getAllPayments,
  Invoice,
  Payment,
} from "@/lib/db";

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [inv, pay] = await Promise.all([getAllInvoices(), getAllPayments()]);
      setInvoices(inv);
      setPayments(pay);
      setLoading(false);
    }
    loadData();
  }, []);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + i.total, 0);

  const exportCSV = () => {
    const headers = ["Invoice Number", "Customer", "Total", "Status", "Date"];
    const rows = invoices.map(inv => [inv.invoiceNumber, inv.customerName, inv.total, inv.status, format(new Date(inv.createdAt), "yyyy-MM-dd")]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices-report.csv";
    a.click();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">Business analytics and insights</p>
          </div>
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
              <FileText className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">${totalInvoiced.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
              <DollarSign className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-success">${totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              <TrendingUp className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-warning">${outstanding.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Invoice Summary</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p>Loading...</p> : (
              <div className="space-y-2">
                <div className="flex justify-between"><span>Total Invoices</span><span className="font-bold">{invoices.length}</span></div>
                <div className="flex justify-between"><span>Paid</span><span className="font-bold text-success">{invoices.filter(i => i.status === 'paid').length}</span></div>
                <div className="flex justify-between"><span>Pending</span><span className="font-bold text-warning">{invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length}</span></div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
