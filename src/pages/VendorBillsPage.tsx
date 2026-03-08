import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  FileText,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface VendorBill {
  id: string;
  bill_number: string;
  supplier_id: string | null;
  supplier_name: string;
  bill_date: string;
  due_date: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  status: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface PaymentRecord {
  id: string;
  bill_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
}

export default function VendorBillsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null);
  const [saving, setSaving] = useState(false);

  const [billForm, setBillForm] = useState({
    supplier_id: "",
    supplier_name: "",
    bill_number: "",
    bill_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    subtotal: 0,
    tax_total: 0,
    total: 0,
    reference: "",
    notes: "",
  });

  const [payForm, setPayForm] = useState({
    amount: 0,
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [billsRes, suppliersRes] = await Promise.all([
      supabase.from("vendor_bills").select("*").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    ]);
    setBills((billsRes.data as VendorBill[]) || []);
    setSuppliers(suppliersRes.data || []);
    setLoading(false);
  }

  function resetBillForm() {
    setBillForm({
      supplier_id: "",
      supplier_name: "",
      bill_number: "",
      bill_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      subtotal: 0,
      tax_total: 0,
      total: 0,
      reference: "",
      notes: "",
    });
  }

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!billForm.bill_number.trim() || !billForm.supplier_name.trim()) {
      toast({ title: "Bill number and supplier are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const total = billForm.subtotal + billForm.tax_total;
      const { error } = await supabase.from("vendor_bills").insert({
        bill_number: billForm.bill_number.trim(),
        supplier_id: billForm.supplier_id || null,
        supplier_name: billForm.supplier_name.trim(),
        bill_date: billForm.bill_date,
        due_date: billForm.due_date || null,
        subtotal: billForm.subtotal,
        tax_total: billForm.tax_total,
        total,
        reference: billForm.reference.trim() || null,
        notes: billForm.notes.trim() || null,
        created_by: user?.id,
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "Bill created successfully" });
      setBillDialogOpen(false);
      resetBillForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error creating bill", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBill || payForm.amount <= 0) {
      toast({ title: "Enter a valid payment amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error: payError } = await supabase.from("vendor_bill_payments").insert({
        bill_id: selectedBill.id,
        amount: payForm.amount,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method,
        reference: payForm.reference.trim() || null,
        notes: payForm.notes.trim() || null,
        created_by: user?.id,
      });
      if (payError) throw payError;

      const newAmountPaid = selectedBill.amount_paid + payForm.amount;
      const newStatus = newAmountPaid >= selectedBill.total ? "paid" : "partial";

      const { error: updateError } = await supabase
        .from("vendor_bills")
        .update({ amount_paid: newAmountPaid, status: newStatus })
        .eq("id", selectedBill.id);
      if (updateError) throw updateError;

      toast({ title: "Payment recorded successfully" });
      setPayDialogOpen(false);
      setSelectedBill(null);
      setPayForm({ amount: 0, payment_date: format(new Date(), "yyyy-MM-dd"), payment_method: "cash", reference: "", notes: "" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error recording payment", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bill: VendorBill) {
    if (!confirm(`Delete bill "${bill.bill_number}"?`)) return;
    try {
      const { error } = await supabase.from("vendor_bills").delete().eq("id", bill.id);
      if (error) throw error;
      toast({ title: "Bill deleted" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error deleting bill", description: error.message, variant: "destructive" });
    }
  }

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPayable = bills.filter((b) => b.status !== "paid").reduce((s, b) => s + (b.total - b.amount_paid), 0);
  const overdueCount = bills.filter((b) => b.status !== "paid" && b.due_date && new Date(b.due_date) < new Date()).length;
  const totalPaid = bills.reduce((s, b) => s + b.amount_paid, 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge variant="default">Paid</Badge>;
      case "partial": return <Badge className="bg-orange-500 hover:bg-orange-600">Partial</Badge>;
      case "overdue": return <Badge variant="destructive">Overdue</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vendor Bills</h1>
            <p className="text-muted-foreground mt-1">Track supplier bills and accounts payable</p>
          </div>
          <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetBillForm}>
                <Plus className="w-4 h-4" />
                New Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Vendor Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBill} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bill Number *</Label>
                    <Input value={billForm.bill_number} onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })} placeholder="BILL-001" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier *</Label>
                    <Select value={billForm.supplier_id} onValueChange={(v) => {
                      const sup = suppliers.find((s) => s.id === v);
                      setBillForm({ ...billForm, supplier_id: v, supplier_name: sup?.name || "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!billForm.supplier_id && (
                  <div className="space-y-2">
                    <Label>Supplier Name *</Label>
                    <Input value={billForm.supplier_name} onChange={(e) => setBillForm({ ...billForm, supplier_name: e.target.value })} placeholder="Supplier name" />
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bill Date</Label>
                    <Input type="date" value={billForm.bill_date} onChange={(e) => setBillForm({ ...billForm, bill_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={billForm.due_date} onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Subtotal</Label>
                    <Input type="number" step="0.01" min="0" value={billForm.subtotal} onChange={(e) => {
                      const sub = parseFloat(e.target.value) || 0;
                      setBillForm({ ...billForm, subtotal: sub, total: sub + billForm.tax_total });
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax</Label>
                    <Input type="number" step="0.01" min="0" value={billForm.tax_total} onChange={(e) => {
                      const tax = parseFloat(e.target.value) || 0;
                      setBillForm({ ...billForm, tax_total: tax, total: billForm.subtotal + tax });
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <Input type="number" value={(billForm.subtotal + billForm.tax_total).toFixed(2)} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={billForm.reference} onChange={(e) => setBillForm({ ...billForm, reference: e.target.value })} placeholder="PO or reference number" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={billForm.notes} onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })} placeholder="Additional notes" rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setBillDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create Bill"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalPayable.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{bills.filter((b) => b.status !== "paid").length} outstanding bills</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{bills.filter((b) => b.status === "paid").length} paid bills</p>
            </CardContent>
          </Card>
          <Card className={overdueCount > 0 ? "border-destructive" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overdueCount}</div>
              <p className="text-xs text-muted-foreground">bills past due date</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search bills..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bills Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>No vendor bills found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => {
                    const balance = bill.total - bill.amount_paid;
                    const isOverdue = bill.status !== "paid" && bill.due_date && new Date(bill.due_date) < new Date();
                    return (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono font-medium">{bill.bill_number}</TableCell>
                        <TableCell>{bill.supplier_name}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(bill.bill_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {bill.due_date ? format(new Date(bill.due_date), "MMM d, yyyy") : "-"}
                          {isOverdue && " ⚠️"}
                        </TableCell>
                        <TableCell>{isOverdue ? <Badge variant="destructive">Overdue</Badge> : statusBadge(bill.status)}</TableCell>
                        <TableCell className="text-right font-mono">${bill.total.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">${bill.amount_paid.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                          ${balance.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              {bill.status !== "paid" && (
                                <DropdownMenuItem onClick={() => {
                                  setSelectedBill(bill);
                                  setPayForm({ ...payForm, amount: bill.total - bill.amount_paid });
                                  setPayDialogOpen(true);
                                }} className="cursor-pointer">
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  Record Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDelete(bill)} className="text-destructive cursor-pointer">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment - {selectedBill?.bill_number}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span>Bill Total:</span><span className="font-mono">${selectedBill?.total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Already Paid:</span><span className="font-mono text-green-600">${selectedBill?.amount_paid.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t mt-2 pt-2">
                  <span>Balance Due:</span>
                  <span className="font-mono text-orange-600">${((selectedBill?.total || 0) - (selectedBill?.amount_paid || 0)).toFixed(2)}</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" min="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Transaction ref" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Recording..." : "Record Payment"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
