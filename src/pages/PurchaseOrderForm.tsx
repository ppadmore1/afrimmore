import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Package,
  Truck,
  Calendar,
  Search,
  PackageCheck,
  CheckCircle2,
  History,
  User,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Supplier {
  id: string;
  name: string;
  code: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  cost_price: number | null;
  unit_price: number;
}

interface ProductSupplierPrice {
  product_id: string;
  cost_price: number;
  supplier_sku: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface POItem {
  id?: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  quantity_received: number;
  unit_cost: number;
  total: number;
}

interface ReceiveItem {
  product_id: string;
  product_name: string;
  ordered: number;
  previously_received: number;
  receiving_now: number;
}

interface GoodsReceipt {
  id: string;
  received_at: string;
  received_by: string | null;
  notes: string | null;
  items: {
    product_id: string;
    product_name: string;
    quantity_received: number;
  }[];
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

type POStatus = "draft" | "submitted" | "confirmed" | "shipped" | "received" | "cancelled";

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { currentBranch } = useBranch();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierPrices, setSupplierPrices] = useState<ProductSupplierPrice[]>([]);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<POStatus>("draft");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([]);

  // Add product dialog
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addUnitCost, setAddUnitCost] = useState(0);

  // Receive goods dialog
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [receiving, setReceiving] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState("");

  // Receiving history
  const [receivingHistory, setReceivingHistory] = useState<GoodsReceipt[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Load supplier-specific pricing when supplier changes
  useEffect(() => {
    if (supplierId) {
      loadSupplierPrices(supplierId);
    }
  }, [supplierId]);

  async function loadSupplierPrices(supplierIdParam: string) {
    try {
      const { data, error } = await supabase
        .from("product_suppliers")
        .select("product_id, cost_price, supplier_sku")
        .eq("supplier_id", supplierIdParam);

      if (error) throw error;
      setSupplierPrices((data || []).map((ps: any) => ({
        product_id: ps.product_id,
        cost_price: Number(ps.cost_price) || 0,
        supplier_sku: ps.supplier_sku,
      })));
    } catch (err) {
      console.error("Error loading supplier prices:", err);
    }
  }

  useEffect(() => {
    // Check for prefilled items from reorder suggestions
    const prefilledItems = searchParams.get("items");
    if (prefilledItems) {
      try {
        const parsed = JSON.parse(decodeURIComponent(prefilledItems));
        if (Array.isArray(parsed)) {
          setItems(parsed.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku || null,
            quantity: item.quantity || 1,
            quantity_received: 0,
            unit_cost: item.unit_cost || 0,
            total: (item.quantity || 1) * (item.unit_cost || 0),
          })));
        }
      } catch (e) {
        console.error("Error parsing prefilled items:", e);
      }
    }
  }, [searchParams]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [suppliersRes, branchesRes, productsRes] = await Promise.all([
        supabase.from("suppliers").select("id, name, code").eq("is_active", true).order("name"),
        supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku, cost_price, unit_price").eq("is_active", true).order("name"),
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (productsRes.error) throw productsRes.error;

      setSuppliers(suppliersRes.data || []);
      setBranches(branchesRes.data || []);
      setProducts(productsRes.data || []);

      // Set default branch
      if (currentBranch) {
        setBranchId(currentBranch.id);
      }

      // Load existing order if editing
      if (isEditing) {
        await loadExistingOrder();
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadExistingOrder() {
    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError) throw orderError;

    setSupplierId(order.supplier_id);
    setBranchId(order.branch_id || "");
    setStatus(order.status);
    setOrderDate(order.order_date);
    setExpectedDate(order.expected_date || "");
    setNotes(order.notes || "");

    const { data: orderItems, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select(`
        *,
        products (name, sku)
      `)
      .eq("purchase_order_id", id);

    if (itemsError) throw itemsError;

    setItems(
      (orderItems || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || "Unknown",
        sku: item.products?.sku || null,
        quantity: item.quantity,
        quantity_received: item.quantity_received || 0,
        unit_cost: Number(item.unit_cost),
        total: Number(item.total),
      }))
    );

    // Load receiving history
    await loadReceivingHistory();
  }

  async function loadReceivingHistory() {
    if (!id) return;

    const { data: receipts, error } = await supabase
      .from("goods_receipts")
      .select(`
        id,
        received_at,
        received_by,
        notes,
        goods_receipt_items (
          product_id,
          quantity_received
        )
      `)
      .eq("purchase_order_id", id)
      .order("received_at", { ascending: false });

    if (error) {
      console.error("Error loading receiving history:", error);
      return;
    }

    // Get product names and user profiles
    const productIds = [...new Set((receipts || []).flatMap((r: any) => 
      r.goods_receipt_items.map((i: any) => i.product_id)
    ))];
    const userIds = [...new Set((receipts || []).map((r: any) => r.received_by).filter(Boolean))];

    const [productsRes, profilesRes] = await Promise.all([
      productIds.length > 0 
        ? supabase.from("products").select("id, name").in("id", productIds)
        : { data: [] },
      userIds.length > 0
        ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] },
    ]);

    const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, p.name]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

    setReceivingHistory(
      (receipts || []).map((r: any) => ({
        id: r.id,
        received_at: r.received_at,
        received_by: r.received_by,
        notes: r.notes,
        items: r.goods_receipt_items.map((i: any) => ({
          product_id: i.product_id,
          product_name: productMap.get(i.product_id) || "Unknown",
          quantity_received: i.quantity_received,
        })),
        profile: profileMap.get(r.received_by),
      }))
    );
  }

  function handleAddProduct() {
    if (!selectedProduct) return;

    const existingIndex = items.findIndex((i) => i.product_id === selectedProduct.id);
    if (existingIndex >= 0) {
      // Update existing item
      const newItems = [...items];
      newItems[existingIndex].quantity += addQuantity;
      newItems[existingIndex].unit_cost = addUnitCost;
      newItems[existingIndex].total = newItems[existingIndex].quantity * addUnitCost;
      setItems(newItems);
    } else {
      // Add new item
      setItems([
        ...items,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity: addQuantity,
          quantity_received: 0,
          unit_cost: addUnitCost,
          total: addQuantity * addUnitCost,
        },
      ]);
    }

    setAddProductOpen(false);
    setSelectedProduct(null);
    setAddQuantity(1);
    setAddUnitCost(0);
    setProductSearch("");
  }

  function handleRemoveItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItemQuantity(index: number, quantity: number) {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].total = quantity * newItems[index].unit_cost;
    setItems(newItems);
  }

  function updateItemCost(index: number, unitCost: number) {
    const newItems = [...items];
    newItems[index].unit_cost = unitCost;
    newItems[index].total = newItems[index].quantity * unitCost;
    setItems(newItems);
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  async function handleSave() {
    if (!supplierId) {
      toast({ title: "Please select a supplier", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (isEditing) {
        // Update existing order
        const { error: orderError } = await supabase
          .from("purchase_orders")
          .update({
            supplier_id: supplierId,
            branch_id: branchId || null,
            status,
            order_date: orderDate,
            expected_date: expectedDate || null,
            subtotal,
            total,
            notes: notes || null,
          })
          .eq("id", id);

        if (orderError) throw orderError;

        // Delete existing items and re-insert
        await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);

        const { error: itemsError } = await supabase.from("purchase_order_items").insert(
          items.map((item) => ({
            purchase_order_id: id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            total: item.total,
          }))
        );

        if (itemsError) throw itemsError;

        toast({ title: "Purchase order updated successfully" });
      } else {
        // Generate PO number
        const today = format(new Date(), "yyyyMMdd");
        const { data: lastPO } = await supabase
          .from("purchase_orders")
          .select("po_number")
          .like("po_number", `PO-${today}-%`)
          .order("po_number", { ascending: false })
          .limit(1);

        let nextNum = 1;
        if (lastPO && lastPO.length > 0) {
          const lastNum = parseInt(lastPO[0].po_number.split("-").pop() || "0");
          nextNum = lastNum + 1;
        }
        const poNumber = `PO-${today}-${String(nextNum).padStart(4, "0")}`;

        // Create new order
        const { data: newOrder, error: orderError } = await supabase
          .from("purchase_orders")
          .insert({
            po_number: poNumber,
            supplier_id: supplierId,
            branch_id: branchId || null,
            status,
            order_date: orderDate,
            expected_date: expectedDate || null,
            subtotal,
            total,
            notes: notes || null,
            created_by: userId,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const { error: itemsError } = await supabase.from("purchase_order_items").insert(
          items.map((item) => ({
            purchase_order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            total: item.total,
          }))
        );

        if (itemsError) throw itemsError;

        toast({ title: "Purchase order created successfully" });
      }

      navigate("/purchase-orders");
    } catch (err: any) {
      console.error("Error saving purchase order:", err);
      toast({ title: "Failed to save purchase order", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openReceiveDialog() {
    setReceiveItems(
      items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        ordered: item.quantity,
        previously_received: item.quantity_received,
        receiving_now: item.quantity - item.quantity_received,
      }))
    );
    setReceiveNotes("");
    setReceiveDialogOpen(true);
  }

  function updateReceivingQuantity(index: number, qty: number) {
    const newItems = [...receiveItems];
    const maxReceivable = newItems[index].ordered - newItems[index].previously_received;
    newItems[index].receiving_now = Math.max(0, Math.min(qty, maxReceivable));
    setReceiveItems(newItems);
  }

  async function handleReceiveGoods() {
    if (!id) return;

    const itemsToReceive = receiveItems.filter((item) => item.receiving_now > 0);
    if (itemsToReceive.length === 0) {
      toast({ title: "No items to receive", variant: "destructive" });
      return;
    }

    setReceiving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      // Update each item's quantity_received and product stock
      for (const item of itemsToReceive) {
        const poItem = items.find((i) => i.product_id === item.product_id);
        if (!poItem?.id) continue;

        const newReceived = item.previously_received + item.receiving_now;

        // Update PO item
        await supabase
          .from("purchase_order_items")
          .update({ quantity_received: newReceived })
          .eq("id", poItem.id);

        // Update product stock
        await supabase
          .from("products")
          .update({
            stock_quantity: supabase.rpc ? undefined : undefined,
          })
          .eq("id", item.product_id);

        // Actually increment stock using raw update
        const { data: product } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", item.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ stock_quantity: product.stock_quantity + item.receiving_now })
            .eq("id", item.product_id);
        }

        // Update branch stock if specified
        if (branchId) {
          const { data: branchStock } = await supabase
            .from("product_branches")
            .select("id, stock_quantity")
            .eq("product_id", item.product_id)
            .eq("branch_id", branchId)
            .single();

          if (branchStock) {
            await supabase
              .from("product_branches")
              .update({ stock_quantity: branchStock.stock_quantity + item.receiving_now })
              .eq("id", branchStock.id);
          } else {
            await supabase.from("product_branches").insert({
              product_id: item.product_id,
              branch_id: branchId,
              stock_quantity: item.receiving_now,
            });
          }
        }

        // Record stock movement
        await supabase.from("stock_movements").insert({
          product_id: item.product_id,
          quantity: item.receiving_now,
          movement_type: "purchase",
          reference_type: "purchase_order",
          reference_id: id,
          branch_id: branchId || null,
          created_by: userId,
          notes: `Received from PO`,
        });
      }

      // Create goods receipt record
      const { data: receipt, error: receiptError } = await supabase
        .from("goods_receipts")
        .insert({
          purchase_order_id: id,
          received_by: userId,
          notes: receiveNotes || null,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create receipt items
      const { error: receiptItemsError } = await supabase
        .from("goods_receipt_items")
        .insert(
          itemsToReceive.map((item) => ({
            goods_receipt_id: receipt.id,
            product_id: item.product_id,
            quantity_received: item.receiving_now,
          }))
        );

      if (receiptItemsError) throw receiptItemsError;

      // Check if all items are fully received
      const allReceived = receiveItems.every(
        (item) => item.previously_received + item.receiving_now >= item.ordered
      );

      // Update PO status and received_date
      await supabase
        .from("purchase_orders")
        .update({
          status: allReceived ? "received" : status,
          received_date: allReceived ? format(new Date(), "yyyy-MM-dd") : null,
        })
        .eq("id", id);

      toast({
        title: "Goods received successfully",
        description: allReceived
          ? "All items received. Order marked as complete."
          : "Partial receipt recorded.",
      });

      setReceiveDialogOpen(false);
      // Reload order to reflect changes
      await loadExistingOrder();
      if (allReceived) {
        setStatus("received");
      }
    } catch (err: any) {
      console.error("Error receiving goods:", err);
      toast({ title: "Failed to receive goods", description: err.message, variant: "destructive" });
    } finally {
      setReceiving(false);
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const canReceiveGoods = isEditing && ["confirmed", "shipped"].includes(status);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">
              {isEditing ? "Edit Purchase Order" : "New Purchase Order"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEditing ? "Update purchase order details" : "Create a new purchase order for your supplier"}
            </p>
          </div>
          <div className="flex gap-2">
            {canReceiveGoods && (
              <Button variant="outline" onClick={openReceiveDialog}>
                <PackageCheck className="w-4 h-4 mr-2" />
                Receive Goods
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Order"}
            </Button>
          </div>
        </div>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Basic information about this purchase order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <Truck className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.code && <span className="text-muted-foreground ml-2">({supplier.code})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destination Branch</Label>
              <Select value={branchId || "all"} onValueChange={(val) => setBranchId(val === "all" ? "" : val)}>
                  <SelectTrigger>
                    <Package className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as POStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Order Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or instructions..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Products to order from this supplier</CardDescription>
            </div>
            <Button onClick={() => setAddProductOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No items added</h3>
                <p className="text-muted-foreground mb-4">Add products to this purchase order</p>
                <Button onClick={() => setAddProductOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-32">Quantity</TableHead>
                      {isEditing && <TableHead className="w-32">Received</TableHead>}
                      <TableHead className="w-40">Unit Cost</TableHead>
                      <TableHead className="text-right w-32">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {item.sku || "-"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-24"
                          />
                        </TableCell>
                        {isEditing && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className={item.quantity_received >= item.quantity ? "text-green-600" : "text-muted-foreground"}>
                                {item.quantity_received}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span>{item.quantity}</span>
                              {item.quantity_received >= item.quantity && (
                                <CheckCircle2 className="w-4 h-4 text-green-600 ml-1" />
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unit_cost}
                              onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                              className="pl-7 w-32"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          ${item.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t p-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-mono">${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total</span>
                        <span className="font-mono">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Receiving History */}
        {isEditing && receivingHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Receiving History
              </CardTitle>
              <CardDescription>
                {receivingHistory.length} receipt{receivingHistory.length !== 1 ? "s" : ""} recorded
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {receivingHistory.map((receipt) => (
                <div key={receipt.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {receipt.profile?.full_name || receipt.profile?.email || "Unknown user"}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(receipt.received_at), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                  {receipt.notes && (
                    <p className="text-sm text-muted-foreground italic">"{receipt.notes}"</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {receipt.items.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {item.product_name}: +{item.quantity_received}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Add Product Dialog */}
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
              <DialogDescription>Select a product to add to this purchase order</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Search className="w-4 h-4 mr-2" />
                      {selectedProduct ? selectedProduct.name : "Search products..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search products..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No products found</CommandEmpty>
                        <CommandGroup>
                          {filteredProducts.slice(0, 10).map((product) => {
                            const supplierPrice = supplierPrices.find((sp) => sp.product_id === product.id);
                            const hasSupplierPrice = !!supplierPrice;
                            return (
                              <CommandItem
                                key={product.id}
                                onSelect={() => {
                                  setSelectedProduct(product);
                                  // Use supplier-specific price if available
                                  setAddUnitCost(supplierPrice?.cost_price || Number(product.cost_price) || 0);
                                  setProductSearchOpen(false);
                                }}
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    {product.sku && <span>SKU: {product.sku}</span>}
                                    {supplierPrice?.supplier_sku && (
                                      <span className="text-primary">Supplier: {supplierPrice.supplier_sku}</span>
                                    )}
                                  </div>
                                </div>
                                {hasSupplierPrice && (
                                  <Badge variant="secondary" className="ml-2">
                                    ${supplierPrice.cost_price.toFixed(2)}
                                  </Badge>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={addUnitCost}
                      onChange={(e) => setAddUnitCost(parseFloat(e.target.value) || 0)}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              {selectedProduct && (
                <div className="text-sm text-muted-foreground">
                  Line total: <span className="font-medium">${(addQuantity * addUnitCost).toFixed(2)}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddProductOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddProduct} disabled={!selectedProduct}>
                Add Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receive Goods Dialog */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5" />
                Receive Goods
              </DialogTitle>
              <DialogDescription>
                Enter the quantities received for each item. Stock will be updated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Ordered</TableHead>
                    <TableHead className="text-center">Previously Received</TableHead>
                    <TableHead className="text-center">Receiving Now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiveItems.map((item, index) => {
                    const remaining = item.ordered - item.previously_received;
                    const isFullyReceived = remaining <= 0;
                    return (
                      <TableRow key={item.product_id} className={isFullyReceived ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.ordered}</TableCell>
                        <TableCell className="text-center">
                          {item.previously_received > 0 ? (
                            <span className="text-green-600">{item.previously_received}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isFullyReceived ? (
                            <div className="flex items-center justify-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              Complete
                            </div>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              max={remaining}
                              value={item.receiving_now}
                              onChange={(e) => updateReceivingQuantity(index, parseInt(e.target.value) || 0)}
                              className="w-24 mx-auto text-center"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Add notes about this receipt..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleReceiveGoods} 
                disabled={receiving || receiveItems.every((i) => i.receiving_now === 0)}
              >
                <PackageCheck className="w-4 h-4 mr-2" />
                {receiving ? "Processing..." : "Confirm Receipt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
