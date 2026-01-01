import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  FileCheck,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getQuotations, deleteQuotation, convertQuotationToInvoice, Quotation } from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [convertDialog, setConvertDialog] = useState<Quotation | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQuotations();
  }, []);

  async function loadQuotations() {
    try {
      const data = await getQuotations();
      setQuotations(data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      console.error("Error loading quotations:", error);
      toast({ title: "Error loading quotations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setProcessing(true);
    try {
      await deleteQuotation(id);
      setQuotations(quotations.filter(q => q.id !== id));
      toast({ title: "Quotation deleted successfully" });
    } catch (error) {
      toast({ title: "Error deleting quotation", variant: "destructive" });
    } finally {
      setProcessing(false);
      setDeleteDialog(null);
    }
  }

  async function handleConvertToInvoice(quotation: Quotation) {
    setProcessing(true);
    try {
      const invoice = await convertQuotationToInvoice(quotation.id);
      toast({ 
        title: "Quotation converted to invoice",
        description: `Invoice ${invoice.invoice_number} created`
      });
      navigate(`/invoices/${invoice.id}`);
    } catch (error) {
      console.error("Error converting quotation:", error);
      toast({ title: "Error converting quotation", variant: "destructive" });
    } finally {
      setProcessing(false);
      setConvertDialog(null);
    }
  }

  const filteredQuotations = quotations.filter(q =>
    q.quotation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getStatusBadge(status: string) {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>;
      case "approved":
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

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
            <h1 className="text-3xl font-bold text-foreground">Quotations</h1>
            <p className="text-muted-foreground mt-1">Manage price quotes for customers</p>
          </div>
          <Link to="/quotations/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Quotation
            </Button>
          </Link>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by quotation number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quotations Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading quotations...</div>
            ) : filteredQuotations.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {quotations.length === 0 ? "No quotations yet" : "No matching quotations"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {quotations.length === 0 
                    ? "Create your first quotation" 
                    : "Try adjusting your search"}
                </p>
                {quotations.length === 0 && (
                  <Link to="/quotations/new">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New Quotation
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium font-mono">
                        {quotation.quotation_number}
                      </TableCell>
                      <TableCell>{quotation.customer_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(quotation.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {quotation.valid_until 
                          ? format(new Date(quotation.valid_until), "MMM d, yyyy")
                          : "-"
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${quotation.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem asChild>
                              <Link to={`/quotations/${quotation.id}`} className="cursor-pointer">
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/quotations/${quotation.id}/edit`} className="cursor-pointer">
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            {quotation.status !== "cancelled" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setConvertDialog(quotation)}
                                  className="cursor-pointer"
                                >
                                  <FileCheck className="w-4 h-4 mr-2" />
                                  Convert to Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setDeleteDialog(quotation.id)}
                              className="text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this quotation? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog && handleDelete(deleteDialog)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={processing}
              >
                {processing ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Convert to Invoice Dialog */}
        <AlertDialog open={!!convertDialog} onOpenChange={() => setConvertDialog(null)}>
          <AlertDialogContent className="bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle>Convert to Invoice</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a new invoice from quotation {convertDialog?.quotation_number}. 
                The quotation will be marked as approved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => convertDialog && handleConvertToInvoice(convertDialog)}
                disabled={processing}
              >
                {processing ? "Converting..." : "Convert to Invoice"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AppLayout>
  );
}
