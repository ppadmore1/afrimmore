import { useState } from "react";
import { format } from "date-fns";
import {
  CloudOff,
  RefreshCw,
  Trash2,
  Eye,
  Clock,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OfflinePOSSale } from "@/hooks/useOfflinePOS";
import { getOfflineDB } from "@/lib/offline-sync";
import { useToast } from "@/hooks/use-toast";

interface PendingSalesViewProps {
  pendingSales: OfflinePOSSale[];
  online: boolean;
  syncing: boolean;
  onSync: () => Promise<{ syncedCount: number; failedCount: number } | undefined>;
  onRefresh: () => void;
}

export function PendingSalesView({
  pendingSales,
  online,
  syncing,
  onSync,
  onRefresh,
}: PendingSalesViewProps) {
  const { toast } = useToast();
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [selectedSale, setSelectedSale] = useState<OfflinePOSSale | null>(null);
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<OfflinePOSSale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleExpanded = (saleId: string) => {
    setExpandedSales((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const handleDeleteSale = async (sale: OfflinePOSSale) => {
    setDeleting(true);
    try {
      const db = await getOfflineDB();
      await db.delete("pos_sales", sale.id);

      // Also remove from pending operations queue
      const operations = await db.getAll("pending_operations");
      for (const op of operations) {
        if (op.table === "pos_sales_rpc" && op.data?.saleData?.id === sale.id) {
          await db.delete("pending_operations", op.id);
        }
      }

      toast({
        title: "Sale Deleted",
        description: `Offline sale ${sale.sale_number} has been removed`,
      });
      onRefresh();
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast({
        title: "Error",
        description: "Failed to delete offline sale",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmSale(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (pendingSales.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Pending Sales</h3>
          <p className="text-sm text-muted-foreground mt-1">
            All offline sales have been synced to the server
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CloudOff className="h-5 w-5 text-destructive" />
              Pending Offline Sales
            </CardTitle>
            <Badge variant="secondary">
              {pendingSales.length} pending
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={!online || syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>
        </div>
        {!online && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-destructive" />
            You're offline. Sales will sync when connection is restored.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {pendingSales.map((sale) => (
              <Collapsible
                key={sale.id}
                open={expandedSales.has(sale.id)}
                onOpenChange={() => toggleExpanded(sale.id)}
              >
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{sale.sale_number}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(sale.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                        {sale.customer_name && (
                          <Badge variant="outline">{sale.customer_name}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(sale.total)}</div>
                          <div className="text-xs text-muted-foreground">
                            {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSale(sale);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmSale(sale);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {expandedSales.has(sale.id) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20 p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sale.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.product_name}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.unit_price)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="mt-4 flex justify-end">
                        <div className="w-48 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>{formatCurrency(sale.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax:</span>
                            <span>{formatCurrency(sale.tax_total)}</span>
                          </div>
                          {sale.discount_total > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Discount:</span>
                              <span className="text-destructive">
                                -{formatCurrency(sale.discount_total)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold border-t pt-1">
                            <span>Total:</span>
                            <span>{formatCurrency(sale.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              {selectedSale?.sale_number} •{" "}
              {selectedSale && format(new Date(selectedSale.created_at), "PPpp")}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Customer</span>
                  <p className="font-medium">{selectedSale.customer_name || "Walk-in"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Method</span>
                  <p className="font-medium capitalize">
                    {selectedSale.payment_method.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount Paid</span>
                  <p className="font-medium">{formatCurrency(selectedSale.amount_paid)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Change</span>
                  <p className="font-medium">{formatCurrency(selectedSale.change_amount)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSale(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmSale} onOpenChange={() => setDeleteConfirmSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offline Sale?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the offline sale{" "}
              <strong>{deleteConfirmSale?.sale_number}</strong> for{" "}
              <strong>{formatCurrency(deleteConfirmSale?.total || 0)}</strong>. This action cannot
              be undone and the sale will not be synced to the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmSale && handleDeleteSale(deleteConfirmSale)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Sale"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
