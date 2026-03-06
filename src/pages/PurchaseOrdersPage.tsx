import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  Trash2,
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Calendar,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type POStatus = "draft" | "submitted" | "confirmed" | "shipped" | "received" | "cancelled";

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  branch_id: string | null;
  status: POStatus;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  notes: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
  branches?: { name: string } | null;
}

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers (name),
          branches (name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as POStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders((data as unknown as PurchaseOrder[]) || []);
    } catch (err) {
      console.error("Error loading purchase orders:", err);
      toast({ title: "Failed to load purchase orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteOrder(id: string) {
    try {
      // Delete items first, then the order
      await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Purchase order deleted" });
      setOrders(orders.filter((o) => o.id !== id));
    } catch (err) {
      console.error("Error deleting purchase order:", err);
      toast({ title: "Failed to delete purchase order", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  function getStatusBadge(status: POStatus) {
    const variants: Record<POStatus, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      draft: { variant: "secondary", icon: <Clock className="w-3 h-3" /> },
      submitted: { variant: "outline", icon: <ClipboardList className="w-3 h-3" /> },
      confirmed: { variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
      shipped: { variant: "default", icon: <Truck className="w-3 h-3" /> },
      received: { variant: "default", icon: <Package className="w-3 h-3" /> },
      cancelled: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
    };

    const { variant, icon } = variants[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1 capitalize">
        {icon}
        {status}
      </Badge>
    );
  }

  const filteredOrders = orders.filter(
    (o) =>
      o.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.suppliers?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusCounts = {
    draft: orders.filter((o) => o.status === "draft").length,
    pending: orders.filter((o) => ["submitted", "confirmed", "shipped"].includes(o.status)).length,
    received: orders.filter((o) => o.status === "received").length,
    total: orders.length,
  };

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
            <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track your purchase orders
            </p>
          </div>
          <Button onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{statusCounts.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{statusCounts.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{statusCounts.received}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No purchase orders found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "Try a different search term" : "Create your first purchase order"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => navigate("/purchase-orders/new")}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Order
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium font-mono">
                        {order.po_number}
                      </TableCell>
                      <TableCell>
                        {order.suppliers?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {order.branches?.name || "All"}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {format(new Date(order.order_date), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.expected_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(order.expected_date), "MMM d, yyyy")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${Number(order.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${order.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(order.id)}
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
      </motion.div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this purchase order and all its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteOrder(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
