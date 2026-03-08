import { useEffect, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DollarSign, AlertTriangle, Clock, TrendingDown } from "lucide-react";

interface AgingBucket {
  label: string;
  min: number;
  max: number | null;
  total: number;
  count: number;
  items: AgingItem[];
}

interface AgingItem {
  id: string;
  number: string;
  name: string;
  date: string;
  due_date: string | null;
  total: number;
  outstanding: number;
  days_overdue: number;
}

function createBuckets(): AgingBucket[] {
  return [
    { label: "Current", min: 0, max: 0, total: 0, count: 0, items: [] },
    { label: "1-30 Days", min: 1, max: 30, total: 0, count: 0, items: [] },
    { label: "31-60 Days", min: 31, max: 60, total: 0, count: 0, items: [] },
    { label: "61-90 Days", min: 61, max: 90, total: 0, count: 0, items: [] },
    { label: "90+ Days", min: 91, max: null, total: 0, count: 0, items: [] },
  ];
}

export default function AgingReportsPage() {
  const [arBuckets, setArBuckets] = useState<AgingBucket[]>(createBuckets());
  const [apBuckets, setApBuckets] = useState<AgingBucket[]>(createBuckets());
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [invoicesRes, poRes] = await Promise.all([
        supabase.from("invoices").select("*").in("status", ["pending", "approved", "draft"]),
        supabase.from("purchase_orders").select("*, suppliers:supplier_id(name)").in("status", ["sent", "draft", "partial"]),
      ]);

      const today = new Date();

      // AR - Accounts Receivable (unpaid invoices)
      const arB = createBuckets();
      (invoicesRes.data || []).forEach((inv: any) => {
        const outstanding = inv.total - (inv.amount_paid || 0);
        if (outstanding <= 0) return;
        const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at);
        const daysOverdue = Math.max(0, differenceInDays(today, dueDate));
        const item: AgingItem = {
          id: inv.id, number: inv.invoice_number, name: inv.customer_name,
          date: inv.created_at, due_date: inv.due_date, total: inv.total,
          outstanding, days_overdue: daysOverdue,
        };
        const bucket = arB.find(b => daysOverdue >= b.min && (b.max === null || daysOverdue <= b.max));
        if (bucket) { bucket.items.push(item); bucket.total += outstanding; bucket.count++; }
      });
      setArBuckets(arB);

      // AP - Accounts Payable (outstanding POs)
      const apB = createBuckets();
      (poRes.data || []).forEach((po: any) => {
        const dueDate = po.expected_date ? new Date(po.expected_date) : new Date(po.order_date);
        const daysOverdue = Math.max(0, differenceInDays(today, dueDate));
        const item: AgingItem = {
          id: po.id, number: po.po_number, name: (po.suppliers as any)?.name || "Unknown",
          date: po.order_date, due_date: po.expected_date, total: po.total,
          outstanding: po.total, days_overdue: daysOverdue,
        };
        const bucket = apB.find(b => daysOverdue >= b.min && (b.max === null || daysOverdue <= b.max));
        if (bucket) { bucket.items.push(item); bucket.total += po.total; bucket.count++; }
      });
      setApBuckets(apB);
    } catch {
      toast({ title: "Error loading aging data", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const totalAR = arBuckets.reduce((s, b) => s + b.total, 0);
  const totalAP = apBuckets.reduce((s, b) => s + b.total, 0);
  const overdueAR = arBuckets.filter(b => b.min > 0).reduce((s, b) => s + b.total, 0);
  const overdueAP = apBuckets.filter(b => b.min > 0).reduce((s, b) => s + b.total, 0);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const bucketColor = (idx: number) => {
    const colors = ["bg-green-100 text-green-800", "bg-yellow-100 text-yellow-800", "bg-orange-100 text-orange-800", "bg-red-100 text-red-800", "bg-red-200 text-red-900"];
    return colors[idx] || colors[0];
  };

  function AgingTable({ buckets }: { buckets: AgingBucket[] }) {
    const allItems = buckets.flatMap(b => b.items).sort((a, b) => b.days_overdue - a.days_overdue);
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3">
          {buckets.map((b, i) => (
            <Card key={b.label} className="text-center">
              <CardContent className="pt-4 pb-3">
                <Badge className={bucketColor(i)}>{b.label}</Badge>
                <p className="text-xl font-bold mt-2">{fmt(b.total)}</p>
                <p className="text-xs text-muted-foreground">{b.count} items</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Detail Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No outstanding items</TableCell></TableRow>
            ) : allItems.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.number}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{format(new Date(item.date), "MMM dd, yyyy")}</TableCell>
                <TableCell>{item.due_date ? format(new Date(item.due_date), "MMM dd, yyyy") : "—"}</TableCell>
                <TableCell className="text-right">{fmt(item.total)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(item.outstanding)}</TableCell>
                <TableCell className="text-right">{item.days_overdue}</TableCell>
                <TableCell>
                  <Badge variant={item.days_overdue === 0 ? "secondary" : item.days_overdue <= 30 ? "outline" : "destructive"}>
                    {item.days_overdue === 0 ? "Current" : item.days_overdue <= 30 ? "Due" : item.days_overdue <= 60 ? "Overdue" : "Critical"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Aging Reports</h1>
          <p className="text-muted-foreground">Track overdue receivables and payables by aging period</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Receivable</p><p className="text-2xl font-bold">{fmt(totalAR)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-sm text-muted-foreground">Overdue AR</p><p className="text-2xl font-bold text-destructive">{fmt(overdueAR)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><TrendingDown className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Payable</p><p className="text-2xl font-bold">{fmt(totalAP)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><Clock className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-sm text-muted-foreground">Overdue AP</p><p className="text-2xl font-bold text-destructive">{fmt(overdueAP)}</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="receivable">
          <TabsList>
            <TabsTrigger value="receivable">Accounts Receivable</TabsTrigger>
            <TabsTrigger value="payable">Accounts Payable</TabsTrigger>
          </TabsList>
          <TabsContent value="receivable">
            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : <AgingTable buckets={arBuckets} />}
          </TabsContent>
          <TabsContent value="payable">
            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : <AgingTable buckets={apBuckets} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
