import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomerBalance,
  getCustomerTransactionHistory,
  getCustomerInvoices,
  getCustomerPOSSales,
  type CustomerBalance,
  type CustomerPaymentHistory,
  type Invoice,
  type POSSale,
} from "@/lib/supabase-db";
import { useSendPaymentReminder } from "@/hooks/useSendPaymentReminder";
import { format } from "date-fns";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<CustomerBalance | null>(null);
  const [transactions, setTransactions] = useState<CustomerPaymentHistory[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [posSales, setPosSales] = useState<POSSale[]>([]);
  const { sendReminder, sending } = useSendPaymentReminder();

  useEffect(() => {
    if (id) {
      loadCustomerData(id);
    }
  }, [id]);

  async function loadCustomerData(customerId: string) {
    try {
      const [balanceData, transactionData, invoiceData, salesData] = await Promise.all([
        getCustomerBalance(customerId),
        getCustomerTransactionHistory(customerId),
        getCustomerInvoices(customerId),
        getCustomerPOSSales(customerId),
      ]);
      setBalance(balanceData);
      setTransactions(transactionData);
      setInvoices(invoiceData);
      setPosSales(salesData);
    } catch (error) {
      console.error("Error loading customer data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSendReminder = async () => {
    if (!balance) return;
    
    const outstandingInvoices = invoices.filter(inv => 
      inv.status !== 'paid' && inv.status !== 'cancelled' && inv.total - inv.amount_paid > 0
    );
    
    await sendReminder({
      customerId: balance.customer.id,
      customerName: balance.customer.name,
      customerEmail: balance.customer.email || '',
      outstandingBalance: balance.outstandingBalance,
      invoices: outstandingInvoices.map(inv => ({
        invoiceNumber: inv.invoice_number,
        total: inv.total,
        amountPaid: inv.amount_paid,
        dueDate: inv.due_date || undefined,
      })),
    });
  };

  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    paid: { variant: "default", label: "Paid" },
    pending: { variant: "secondary", label: "Pending" },
    draft: { variant: "outline", label: "Draft" },
    approved: { variant: "default", label: "Approved" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!balance) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Customer not found</h2>
          <Button onClick={() => navigate("/customers")}>Back to Customers</Button>
        </div>
      </AppLayout>
    );
  }

  const { customer, totalInvoiced, totalPaid, outstandingBalance, invoiceCount, paidInvoiceCount } = balance;

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {customer.email}
                    </span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {customer.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {outstandingBalance > 0 && customer.email && (
              <Button 
                variant="outline" 
                className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                onClick={handleSendReminder}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Reminder
              </Button>
            )}
            <Link to={`/invoices/new?customer=${id}`}>
              <Button variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                New Invoice
              </Button>
            </Link>
            <Link to={`/customers/${id}/edit`}>
              <Button className="gap-2">
                <Edit className="w-4 h-4" />
                Edit Customer
              </Button>
            </Link>
          </div>
        </div>

        {/* Balance Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">{invoiceCount} invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">{paidInvoiceCount} paid invoices</p>
            </CardContent>
          </Card>

          <Card className={outstandingBalance > 0 ? "border-orange-500" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              {outstandingBalance > 0 ? (
                <TrendingUp className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {outstandingBalance > 0 ? 'Amount due' : 'All paid up!'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">POS Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${posSales.reduce((sum, s) => sum + s.total, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">{posSales.length} transactions</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="history">Transaction History</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="info">Customer Info</TabsTrigger>
          </TabsList>

          {/* Transaction History */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(txn.date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              txn.type === 'invoice' ? 'secondary' : 
                              txn.type === 'payment' ? 'default' : 'outline'
                            }>
                              {txn.type === 'invoice' ? 'Invoice' : 
                               txn.type === 'payment' ? 'Payment' : 'POS Sale'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                          <TableCell>{txn.description}</TableCell>
                          <TableCell className={`text-right font-mono ${txn.amount < 0 ? 'text-green-600' : txn.amount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {txn.amount === 0 ? '-' : 
                             txn.amount < 0 ? `-$${Math.abs(txn.amount).toFixed(2)}` : 
                             `$${txn.amount.toFixed(2)}`}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${txn.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            ${txn.balance.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Invoices
                </CardTitle>
                <Link to={`/invoices/new?customer=${id}`}>
                  <Button size="sm">Create Invoice</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No invoices yet</p>
                    <Link to={`/invoices/new?customer=${id}`}>
                      <Button size="sm" className="mt-3">Create First Invoice</Button>
                    </Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => {
                        const invoiceBalance = invoice.total - invoice.amount_paid;
                        return (
                          <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                            <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(invoice.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusConfig[invoice.status]?.variant || "outline"}>
                                {statusConfig[invoice.status]?.label || invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">${invoice.total.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">${invoice.amount_paid.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-mono font-medium ${invoiceBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              ${invoiceBalance.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Info */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-foreground">{customer.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-foreground">{customer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-foreground">{customer.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tax ID</p>
                    <p className="text-foreground">{customer.tax_id || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="text-foreground">
                      {[customer.address, customer.city, customer.country].filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                  {customer.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p className="text-foreground whitespace-pre-wrap">{customer.notes}</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t text-sm text-muted-foreground">
                  <p>Customer since {format(new Date(customer.created_at), "MMMM d, yyyy")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
}
