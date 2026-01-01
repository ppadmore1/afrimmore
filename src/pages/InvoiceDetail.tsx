import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Edit, 
  Trash2,
  DollarSign,
  Calendar,
  User,
  FileText,
  Plus,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  getInvoice, 
  getCustomer, 
  deleteInvoice,
  getPayments,
  addPayment,
  getNextPaymentNumber,
  Invoice, 
  Customer,
  Payment,
  PaymentMethod,
} from "@/lib/supabase-db";
import { downloadInvoicePDF, printInvoice } from "@/lib/pdf";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { className: string; label: string }> = {
  paid: { className: "bg-success text-success-foreground", label: "Paid" },
  pending: { className: "border-warning text-warning", label: "Pending" },
  approved: { className: "bg-primary text-primary-foreground", label: "Approved" },
  draft: { className: "bg-secondary text-secondary-foreground", label: "Draft" },
  cancelled: { className: "bg-destructive text-destructive-foreground", label: "Cancelled" },
};

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    
    try {
      const invoiceData = await getInvoice(id);
      if (invoiceData) {
        setInvoice(invoiceData);
        if (invoiceData.customer_id) {
          const customerData = await getCustomer(invoiceData.customer_id);
          setCustomer(customerData || null);
        }
        const allPayments = await getPayments();
        setPayments(allPayments.filter(p => p.invoice_id === id));
      }
    } catch (error) {
      console.error("Error loading invoice:", error);
      toast({ title: "Error loading invoice", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    
    setProcessing(true);
    try {
      await deleteInvoice(invoice.id);
      toast({ title: "Invoice deleted successfully" });
      navigate("/invoices");
    } catch (error) {
      toast({ title: "Error deleting invoice", variant: "destructive" });
    } finally {
      setProcessing(false);
      setDeleteDialog(false);
    }
  }

  async function handleAddPayment() {
    if (!invoice || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const paymentNumber = await getNextPaymentNumber();
      await addPayment({
        payment_number: paymentNumber,
        invoice_id: invoice.id,
        pos_sale_id: null,
        amount,
        payment_method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
        created_by: null,
      });

      toast({ title: "Payment recorded successfully" });
      setPaymentDialog(false);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      loadData(); // Reload to get updated data
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({ title: "Error recording payment", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  function handleDownload() {
    if (!invoice) return;
    downloadInvoicePDF(invoice, customer || undefined, payments);
    toast({ title: "PDF downloaded" });
  }

  function handlePrint() {
    if (!invoice) return;
    printInvoice(invoice, customer || undefined, payments);
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = invoice ? invoice.total - totalPaid : 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Invoice not found</h3>
          <Link to="/invoices">
            <Button variant="outline">Back to Invoices</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const items = invoice.items || [];

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{invoice.invoice_number}</h1>
              <Badge className={statusConfig[invoice.status]?.className || "bg-secondary"}>
                {statusConfig[invoice.status]?.label || invoice.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{invoice.customer_name}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {balance > 0 && (
              <Button size="sm" onClick={() => setPaymentDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Payment
              </Button>
            )}
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={() => setDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold font-mono">${invoice.total.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="text-xl font-bold font-mono text-success">${totalPaid.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance Due</p>
                <p className="text-xl font-bold font-mono text-warning">${balance.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="text-xl font-bold">
                  {invoice.due_date ? format(new Date(invoice.due_date), "MMM dd, yyyy") : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Invoice Items */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">Item</th>
                      <th className="pb-3 font-medium text-muted-foreground text-center">Qty</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Price</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-4">
                          <p className="font-medium">{item.description}</p>
                        </td>
                        <td className="py-4 text-center">{item.quantity}</td>
                        <td className="py-4 text-right font-mono">${item.unit_price.toFixed(2)}</td>
                        <td className="py-4 text-right font-mono font-medium">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono">${invoice.tax_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-mono">-${invoice.discount_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="font-mono">${invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{customer?.name || invoice.customer_name}</p>
                </div>
                {(customer?.email || invoice.customer_email) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p>{customer?.email || invoice.customer_email}</p>
                  </div>
                )}
                {customer?.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p>{customer.phone}</p>
                  </div>
                )}
                {(customer?.address || invoice.customer_address) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="whitespace-pre-line">{customer?.address || invoice.customer_address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes & Terms */}
            {(invoice.payment_terms || invoice.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes & Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invoice.payment_terms && (
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Terms</p>
                      <p>{invoice.payment_terms}</p>
                    </div>
                  )}
                  {invoice.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="whitespace-pre-line">{invoice.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment History
                </CardTitle>
                {balance > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setPaymentDialog(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No payments recorded</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium capitalize">{payment.payment_method.replace("_", " ")}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.created_at), "MMM dd, yyyy")}
                          </p>
                          {payment.reference && (
                            <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                          )}
                        </div>
                        <p className="font-mono font-bold text-success">
                          +${payment.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Payment Dialog */}
        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Balance due: ${balance.toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  placeholder="Transaction reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPayment} disabled={processing || !paymentAmount}>
                {processing ? "Saving..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete invoice {invoice.invoice_number}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={processing}
              >
                {processing ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AppLayout>
  );
}
