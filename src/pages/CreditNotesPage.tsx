import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, FileText, Trash2, CheckCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface CreditNote {
  id: string;
  credit_note_number: string;
  invoice_id: string | null;
  customer_id: string | null;
  customer_name: string;
  reason: string | null;
  status: string;
  subtotal: number;
  tax_total: number;
  total: number;
  refund_method: string | null;
  created_at: string;
}

interface InvoiceOption {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_address: string | null;
  total: number;
  amount_paid: number;
}

export default function CreditNotesPage() {
  const { user } = useAuth();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    invoice_id: "", reason: "", refund_method: "credit", amount: 0,
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [cnRes, invRes] = await Promise.all([
        supabase.from("credit_notes").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, customer_name, customer_id, customer_email, customer_address, total, amount_paid").in("status", ["paid", "approved", "pending"]),
      ]);
      setCreditNotes((cnRes.data || []) as CreditNote[]);
      setInvoices((invRes.data || []) as InvoiceOption[]);
    } catch {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    const inv = invoices.find(i => i.id === form.invoice_id);
    if (!inv) { toast({ title: "Select an invoice", variant: "destructive" }); return; }
    if (form.amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }

    const prefix = "CN-" + format(new Date(), "yyyyMMdd") + "-";
    const { count } = await supabase.from("credit_notes").select("*", { count: "exact", head: true });
    const num = prefix + String((count || 0) + 1).padStart(4, "0");

    const { error } = await supabase.from("credit_notes").insert({
      credit_note_number: num,
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      customer_email: inv.customer_email,
      customer_address: inv.customer_address,
      reason: form.reason,
      status: "issued",
      subtotal: form.amount,
      tax_total: 0,
      total: form.amount,
      refund_method: form.refund_method,
      created_by: user?.id,
    });

    if (error) { toast({ title: "Error creating credit note", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Credit note created" });
    setShowCreate(false);
    setForm({ invoice_id: "", reason: "", refund_method: "credit", amount: 0 });
    loadData();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("credit_notes").delete().eq("id", id);
    if (error) { toast({ title: "Error deleting", variant: "destructive" }); return; }
    setCreditNotes(creditNotes.filter(c => c.id !== id));
    setDeleteId(null);
    toast({ title: "Credit note deleted" });
  }

  async function handleApply(cn: CreditNote) {
    if (!cn.invoice_id) return;
    // Update invoice amount_paid
    const { data: inv } = await supabase.from("invoices").select("amount_paid").eq("id", cn.invoice_id).single();
    if (inv) {
      await supabase.from("invoices").update({ amount_paid: inv.amount_paid - cn.total }).eq("id", cn.invoice_id);
    }
    await supabase.from("credit_notes").update({ status: "applied", refunded_at: new Date().toISOString() }).eq("id", cn.id);
    toast({ title: "Credit note applied to invoice" });
    loadData();
  }

  const filtered = creditNotes.filter(c =>
    c.credit_note_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalIssued = creditNotes.filter(c => c.status === "issued").reduce((s, c) => s + c.total, 0);
  const totalApplied = creditNotes.filter(c => c.status === "applied").reduce((s, c) => s + c.total, 0);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Credit Notes</h1>
            <p className="text-muted-foreground">Issue refunds and credits against invoices</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New Credit Note</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Credit Notes</p>
            <p className="text-2xl font-bold">{creditNotes.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Outstanding Credits</p>
            <p className="text-2xl font-bold text-orange-600">{fmt(totalIssued)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Applied Credits</p>
            <p className="text-2xl font-bold text-green-600">{fmt(totalApplied)}</p>
          </CardContent></Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search credit notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credit Note #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Refund Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No credit notes found</TableCell></TableRow>
            ) : filtered.map(cn => (
              <TableRow key={cn.id}>
                <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
                <TableCell>{cn.customer_name}</TableCell>
                <TableCell className="max-w-[200px] truncate">{cn.reason || "—"}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(cn.total)}</TableCell>
                <TableCell className="capitalize">{cn.refund_method}</TableCell>
                <TableCell>
                  <Badge variant={cn.status === "applied" ? "default" : cn.status === "issued" ? "secondary" : "outline"}>
                    {cn.status}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(cn.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell className="space-x-1">
                  {cn.status === "issued" && (
                    <Button size="sm" variant="outline" onClick={() => handleApply(cn)}>
                      <CheckCircle className="h-3 w-3 mr-1" />Apply
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(cn.id)}>
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
        <DialogContent>
          <DialogHeader><DialogTitle>New Credit Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Invoice</Label>
              <Select value={form.invoice_id} onValueChange={v => {
                setForm({ ...form, invoice_id: v });
                const inv = invoices.find(i => i.id === v);
                if (inv) setForm(f => ({ ...f, invoice_id: v, amount: inv.total }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.customer_name} ({fmt(inv.total)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit Amount</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Refund Method</Label>
              <Select value={form.refund_method} onValueChange={v => setForm({ ...form, refund_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Store Credit</SelectItem>
                  <SelectItem value="refund">Cash Refund</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason for credit note..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Credit Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit Note?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
