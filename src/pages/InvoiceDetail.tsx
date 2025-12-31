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
} from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  getInvoice, 
  getCustomer, 
  deleteInvoice,
  getPaymentsByInvoice,
  Invoice, 
  Customer,
  Payment,
} from "@/lib/db";
import { downloadInvoicePDF, printInvoice } from "@/lib/pdf";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { variant: "success" | "warning" | "info" | "muted" | "destructive"; label: string }> = {
  paid: { variant: "success", label: "Paid" },
  partial: { variant: "warning", label: "Partial" },
  sent: { variant: "info", label: "Sent" },
  draft: { variant: "muted", label: "Draft" },
  overdue: { variant: "destructive", label: "Overdue" },
  cancelled: { variant: "muted", label: "Cancelled" },
};

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      
      try {
        const invoiceData = await getInvoice(id);
        if (invoiceData) {
          setInvoice(invoiceData);
          const customerData = await getCustomer(invoiceData.customerId);
          setCustomer(customerData || null);
          const paymentsData = await getPaymentsByInvoice(id);
          setPayments(paymentsData);
        }
      } catch (error) {
        console.error("Error loading invoice:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleDelete() {
    if (!invoice) return;
    
    if (confirm("Are you sure you want to delete this invoice?")) {
      try {
        await deleteInvoice(invoice.id);
        toast({ title: "Invoice deleted successfully" });
        navigate("/invoices");
      } catch (error) {
        toast({ title: "Error deleting invoice", variant: "destructive" });
      }
    }
  }

  function handleDownload() {
    if (!invoice) return;
    downloadInvoicePDF(invoice, customer || undefined);
    toast({ title: "PDF downloaded" });
  }

  function handlePrint() {
    if (!invoice) return;
    printInvoice(invoice, customer || undefined);
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
              <h1 className="text-3xl font-bold text-foreground">{invoice.invoiceNumber}</h1>
              <Badge variant={statusConfig[invoice.status]?.variant || "muted"} className="text-sm">
                {statusConfig[invoice.status]?.label || invoice.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{invoice.customerName}</p>
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
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
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
                <p className="text-xl font-bold font-mono">${totalPaid.toFixed(2)}</p>
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
                <p className="text-xl font-bold font-mono">${balance.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="text-xl font-bold">{format(new Date(invoice.dueDate), "MMM dd, yyyy")}</p>
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
                    {invoice.items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-4">
                          <p className="font-medium">{item.productName}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </td>
                        <td className="py-4 text-center">{item.quantity}</td>
                        <td className="py-4 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
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
                    <span className="font-mono">${invoice.taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-mono">-${invoice.discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="font-mono">${invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{customer?.name || invoice.customerName}</p>
                </div>
                {customer?.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p>{customer.email}</p>
                  </div>
                )}
                {customer?.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p>{customer.phone}</p>
                  </div>
                )}
                {customer?.billingAddress && (
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Address</p>
                    <p className="whitespace-pre-line">{customer.billingAddress}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {(invoice.paymentTerms || invoice.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes & Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invoice.paymentTerms && (
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Terms</p>
                      <p>{invoice.paymentTerms}</p>
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
            {payments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{payment.method}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.date), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <p className="font-mono font-bold text-success">
                          +${payment.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
