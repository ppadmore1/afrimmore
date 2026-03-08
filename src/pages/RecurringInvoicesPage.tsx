import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Trash2, Pause, Play, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface RecurringInvoice {
  id: string;
  customer_name: string;
  customer_id: string | null;
  frequency: string;
  next_due_date: string;
  end_date: string | null;
  total: number;
  status: string;
  invoices_generated: number;
  last_generated_at: string | null;
  notes: string | null;
  created_at: string;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
}

export default function RecurringInvoicesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "", frequency: "monthly", next_due_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "", total: 0, payment_terms: "Net 30", notes: "", description: "", quantity: 1, unit_price: 0,
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [riRes, custRes] = await Promise.all([
        supabase.from("recurring_invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("id, name, email, address"),
      ]);
      setItems((riRes.data || []) as RecurringInvoice[]);
      setCustomers((custRes.data || []) as CustomerOption[]);
    } catch {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    const cust = customers.find(c => c.id === form.customer_id);
    if (!cust) { toast({ title: "Select a customer", variant: "destructive" }); return; }
    if (form.unit_price <= 0) { toast({ title: "Enter a valid price", variant: "destructive" }); return; }

    const total = form.quantity * form.unit_price;
    const { data: ri, error } = await supabase.from("recurring_invoices").insert({
      customer_id: cust.id, customer_name: cust.name, customer_email: cust.email,
      customer_address: cust.address, frequency: form.frequency,
      next_due_date: form.next_due_date, end_date: form.end_date || null,
      subtotal: total, total, payment_terms: form.payment_terms,
      notes: form.notes, status: "active", created_by: user?.id,
    }).select().single();

    if (error || !ri) { toast({ title: "Error creating", description: error?.message, variant: "destructive" }); return; }

    await supabase.from("recurring_invoice_items").insert({
      recurring_invoice_id: ri.id, description: form.description || "Recurring service",
      quantity: form.quantity, unit_price: form.unit_price, total,
    });

    toast({ title: "Recurring invoice created" });
    setShowCreate(false);
    setForm({ customer_id: "", frequency: "monthly", next_due_date: format(new Date(), "yyyy-MM-dd"), end_date: "", total: 0, payment_terms: "Net 30", notes: "", description: "", quantity: 1, unit_price: 0 });
    loadData();
  }

  async function handleDelete(id: string) {
    await supabase.from("recurring_invoices").delete().eq("id", id);
    setItems(items.filter(i => i.id !== id));
    setDeleteId(null);
    toast({ title: "Recurring invoice deleted" });
  }

  async function toggleStatus(ri: RecurringInvoice) {
    const newStatus = ri.status === "active" ? "paused" : "active";
    await supabase.from("recurring_invoices").update({ status: newStatus }).eq("id", ri.id);
    setItems(items.map(i => i.id === ri.id ? { ...i, status: newStatus } : i));
    toast({ title: `Recurring invoice ${newStatus}` });
  }

  async function generateNow(ri: RecurringInvoice) {
    setGenerating(ri.id);
    try {
      // Get items
      const { data: riItems } = await supabase.from("recurring_invoice_items").select("*").eq("recurring_invoice_id", ri.id);

      // Generate invoice number
      const prefix = "INV-" + format(new Date(), "yyyyMMdd") + "-";
      const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
      const invNum = prefix + String((count || 0) + 1).padStart(4, "0");

      // Create invoice
      const { data: inv, error } = await supabase.from("invoices").insert({
        invoice_number: invNum, customer_id: ri.customer_id, customer_name: ri.customer_name,
        customer_email: (ri as any).customer_email, customer_address: (ri as any).customer_address,
        status: "pending", subtotal: ri.total, total: ri.total,
        payment_terms: (ri as any).payment_terms, notes: ri.notes,
        due_date: ri.next_due_date, created_by: user?.id,
      }).select().single();

      if (error || !inv) throw error;

      // Copy items
      if (riItems && riItems.length > 0) {
        await supabase.from("invoice_items").insert(
          riItems.map((item: any) => ({
            invoice_id: inv.id, description: item.description, quantity: item.quantity,
            unit_price: item.unit_price, tax_rate: item.tax_rate || 0, discount: item.discount || 0, total: item.total,
          }))
        );
      }

      // Calculate next due date
      const nextDate = new Date(ri.next_due_date);
      if (ri.frequency === "weekly") nextDate.setDate(nextDate.getDate() + 7);
      else if (ri.frequency === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
      else if (ri.frequency === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
      else if (ri.frequency === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);

      await supabase.from("recurring_invoices").update({
        next_due_date: format(nextDate, "yyyy-MM-dd"),
        last_generated_at: new Date().toISOString(),
        invoices_generated: ri.invoices_generated + 1,
      }).eq("id", ri.id);

      toast({ title: "Invoice generated", description: `Invoice ${invNum} created` });
      loadData();
    } catch (err: any) {
      toast({ title: "Error generating invoice", description: err?.message, variant: "destructive" });
    } finally { setGenerating(null); }
  }

  const filtered = items.filter(i =>
    i.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeCount = items.filter(i => i.status === "active").length;
  const monthlyRevenue = items.filter(i => i.status === "active").reduce((s, i) => s + i.total, 0);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recurring Invoices</h1>
            <p className="text-muted-foreground">Automate invoice generation on a schedule</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New Recurring Invoice</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active Schedules</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Est. Monthly Revenue</p>
            <p className="text-2xl font-bold text-green-600">{fmt(monthlyRevenue)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Generated</p>
            <p className="text-2xl font-bold">{items.reduce((s, i) => s + i.invoices_generated, 0)}</p>
          </CardContent></Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No recurring invoices</TableCell></TableRow>
            ) : filtered.map(ri => (
              <TableRow key={ri.id}>
                <TableCell className="font-medium">{ri.customer_name}</TableCell>
                <TableCell className="capitalize">{ri.frequency}</TableCell>
                <TableCell>{format(new Date(ri.next_due_date), "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(ri.total)}</TableCell>
                <TableCell>{ri.invoices_generated}</TableCell>
                <TableCell>
                  <Badge variant={ri.status === "active" ? "default" : ri.status === "paused" ? "secondary" : "outline"}>
                    {ri.status}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  <Button size="sm" variant="outline" onClick={() => generateNow(ri)} disabled={generating === ri.id}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${generating === ri.id ? "animate-spin" : ""}`} />Generate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(ri)}>
                    {ri.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(ri.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Recurring Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select value={form.payment_terms} onValueChange={v => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.next_due_date} onChange={e => setForm({ ...form, next_due_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Line Item Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly service fee" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Unit Price</Label>
                <Input type="number" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Invoice?</AlertDialogTitle>
            <AlertDialogDescription>This will stop all future invoice generation.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
