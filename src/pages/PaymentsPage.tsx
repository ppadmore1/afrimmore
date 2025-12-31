import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  CreditCard, 
  Trash2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getAllPayments, 
  getAllInvoices,
  addPayment,
  deletePayment,
  updateInvoice,
  getPaymentsByInvoice,
  Payment, 
  Invoice,
} from "@/lib/db";
import { toast } from "@/hooks/use-toast";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [paymentsData, invoicesData] = await Promise.all([
        getAllPayments(),
        getAllInvoices(),
      ]);
      setPayments(paymentsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setInvoices(invoicesData.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled'));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedInvoiceId || !amount) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      const payment: Payment = {
        id: uuidv4(),
        invoiceId: selectedInvoiceId,
        amount: parseFloat(amount),
        method,
        reference: reference.trim(),
        date: new Date(date),
        createdAt: new Date(),
      };

      await addPayment(payment);

      // Update invoice status
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        const existingPayments = await getPaymentsByInvoice(selectedInvoiceId);
        const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0) + payment.amount;
        
        if (totalPaid >= invoice.total) {
          await updateInvoice({ ...invoice, status: 'paid' });
        } else if (totalPaid > 0) {
          await updateInvoice({ ...invoice, status: 'partial' });
        }
      }

      toast({ title: "Payment recorded successfully" });
      setDialogOpen(false);
      loadData();
      
      // Reset form
      setSelectedInvoiceId("");
      setAmount("");
      setMethod("Bank Transfer");
      setReference("");
      setDate(format(new Date(), "yyyy-MM-dd"));
    } catch (error) {
      toast({ title: "Error recording payment", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this payment?")) {
      try {
        await deletePayment(id);
        setPayments(payments.filter(p => p.id !== id));
        toast({ title: "Payment deleted successfully" });
      } catch (error) {
        toast({ title: "Error deleting payment", variant: "destructive" });
      }
    }
  }

  const getInvoiceNumber = (invoiceId: string) => {
    const allInvoices = [...invoices];
    getAllInvoices().then(all => {
      const invoice = all.find(inv => inv.id === invoiceId);
      return invoice?.invoiceNumber || "Unknown";
    });
    return "Loading...";
  };

  const filteredPayments = payments.filter(payment =>
    payment.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

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
            <h1 className="text-3xl font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground mt-1">Track and manage payments</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice *</Label>
                  <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber} - {invoice.customerName} (${invoice.total.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Check">Check</SelectItem>
                      <SelectItem value="PayPal">PayPal</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Transaction reference or note"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Record Payment</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-success flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-success-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Received</p>
                <p className="text-3xl font-bold font-mono">
                  ${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {payments.length === 0 ? "No payments yet" : "No matching payments"}
                </h3>
                <p className="text-muted-foreground">
                  {payments.length === 0 ? "Record your first payment to track it here" : "Try adjusting your search"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-6 h-6 text-success" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{payment.method}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payment.reference || "No reference"} • {format(new Date(payment.date), "MMM dd, yyyy")}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold font-mono text-success">
                        +${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(payment.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
