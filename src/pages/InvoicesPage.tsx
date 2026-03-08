import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, MoreHorizontal, Edit, Trash2, Eye, AlertTriangle, Mail, Filter } from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInvoices, deleteInvoice, Invoice } from "@/lib/supabase-db";
import { useSendPaymentReminder } from "@/hooks/useSendPaymentReminder";
import { toast } from "@/hooks/use-toast";

type StatusFilter = "all" | "draft" | "pending" | "approved" | "paid" | "cancelled" | "overdue";

function getOverdueInfo(inv: Invoice): { isOverdue: boolean; daysOverdue: number } {
  if (!inv.due_date || inv.status === "paid" || inv.status === "cancelled") {
    return { isOverdue: false, daysOverdue: 0 };
  }
  const due = new Date(inv.due_date);
  const overdue = isPast(due) && inv.amount_paid < inv.total;
  return { isOverdue: overdue, daysOverdue: overdue ? differenceInDays(new Date(), due) : 0 };
}

function getStatusBadge(inv: Invoice) {
  const { isOverdue, daysOverdue } = getOverdueInfo(inv);

  if (isOverdue) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        Overdue {daysOverdue}d
      </Badge>
    );
  }

  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    paid: "default",
    draft: "outline",
    cancelled: "secondary",
    pending: "secondary",
    approved: "default",
  };

  return <Badge variant={variants[inv.status] || "secondary"}>{inv.status}</Badge>;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { sendReminder, sending } = useSendPaymentReminder();

  useEffect(() => { loadInvoices(); }, []);

  async function loadInvoices() {
    try {
      const data = await getInvoices();
      setInvoices(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      toast({ title: "Error loading invoices", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    setProcessing(true);
    try {
      await deleteInvoice(id);
      setInvoices(invoices.filter(i => i.id !== id));
      toast({ title: "Invoice deleted" });
    } catch { toast({ title: "Error deleting", variant: "destructive" }); }
    finally { setProcessing(false); setDeleteDialog(null); }
  }

  async function handleSendReminder(inv: Invoice) {
    if (!inv.customer_email) {
      toast({ title: "No email", description: "Customer has no email address on file", variant: "destructive" });
      return;
    }
    const balance = inv.total - inv.amount_paid;
    await sendReminder({
      customerId: inv.customer_id || "",
      customerName: inv.customer_name,
      customerEmail: inv.customer_email,
      outstandingBalance: balance,
      invoices: [{
        invoiceNumber: inv.invoice_number,
        total: inv.total,
        amountPaid: inv.amount_paid,
        dueDate: inv.due_date || undefined,
      }],
    });
  }

  // Filtering
  const filtered = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    if (statusFilter === "overdue") return getOverdueInfo(inv).isOverdue;
    return inv.status === statusFilter;
  });

  // Stats
  const totalRevenue = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.amount_paid, 0);
  const overdueInvoices = invoices.filter(i => getOverdueInfo(i).isOverdue);
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + (i.total - i.amount_paid), 0);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-1">Manage invoices and payments</p>
          </div>
          <Link to="/invoices/new">
            <Button className="gap-2"><Plus className="w-4 h-4" />New Invoice</Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-mono">${totalRevenue.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paid</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-mono text-emerald-600">${totalPaid.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-mono text-amber-600">${(totalRevenue - totalPaid).toLocaleString()}</div></CardContent>
          </Card>
          <Card className={overdueInvoices.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              {overdueInvoices.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
              Overdue
            </CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-destructive">${overdueAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{overdueInvoices.length} invoice{overdueInvoices.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by invoice # or customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="overdue">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-destructive" /> Overdue
                    </span>
                  </SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No invoices found</h3>
                <p className="text-sm text-muted-foreground">
                  {statusFilter !== "all" ? "Try changing the filter" : "Create your first invoice to get started"}
                </p>
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => {
                      const { isOverdue, daysOverdue } = getOverdueInfo(inv);
                      const balance = inv.total - inv.amount_paid;

                      return (
                        <TableRow key={inv.id} className={isOverdue ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono">
                            <Link to={`/invoices/${inv.id}`} className="hover:underline text-primary">
                              {inv.invoice_number}
                            </Link>
                          </TableCell>
                          <TableCell>{inv.customer_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(inv.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(inv)}</TableCell>
                          <TableCell className="text-right font-mono">${inv.total.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono ${balance > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            ${balance.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/${inv.id}`}><Eye className="w-4 h-4 mr-2" />View</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/${inv.id}/edit`}><Edit className="w-4 h-4 mr-2" />Edit</Link>
                                </DropdownMenuItem>
                                {isOverdue && inv.customer_email && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleSendReminder(inv)}
                                      disabled={sending}
                                    >
                                      <Mail className="w-4 h-4 mr-2" />
                                      {sending ? "Sending..." : "Send Reminder"}
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteDialog(inv.id)} className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone. The invoice and all related data will be permanently deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteDialog && handleDelete(deleteDialog)} className="bg-destructive" disabled={processing}>
                {processing ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AppLayout>
  );
}
