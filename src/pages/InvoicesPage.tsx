import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, MoreHorizontal, Edit, Trash2, Eye, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getInvoices, deleteInvoice, Invoice } from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

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

  const filtered = invoices.filter(i => i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || i.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalRevenue = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.amount_paid, 0);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-foreground">Invoices</h1><p className="text-muted-foreground mt-1">Manage invoices and payments</p></div>
          <Link to="/invoices/new"><Button className="gap-2"><Plus className="w-4 h-4" />New Invoice</Button></Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-mono">${totalRevenue.toLocaleString()}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-mono text-success">${totalPaid.toLocaleString()}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-mono text-warning">${(totalRevenue - totalPaid).toLocaleString()}</div></CardContent></Card>
        </div>
        <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div></CardContent></Card>
        <Card><CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
            <div className="p-8 text-center"><FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-medium mb-2">No invoices</h3></div>
          ) : (
            <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono"><Link to={`/invoices/${inv.id}`} className="hover:underline text-primary">{inv.invoice_number}</Link></TableCell>
                  <TableCell>{inv.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(inv.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell><Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">${inv.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem asChild><Link to={`/invoices/${inv.id}`}><Eye className="w-4 h-4 mr-2" />View</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link to={`/invoices/${inv.id}/edit`}><Edit className="w-4 h-4 mr-2" />Edit</Link></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteDialog(inv.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent></Card>
        <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}><AlertDialogContent className="bg-background"><AlertDialogHeader><AlertDialogTitle>Delete Invoice</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteDialog && handleDelete(deleteDialog)} className="bg-destructive" disabled={processing}>{processing ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </motion.div>
    </AppLayout>
  );
}
