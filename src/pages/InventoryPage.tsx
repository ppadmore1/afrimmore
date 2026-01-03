import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Package, 
  Search, 
  AlertTriangle,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Filter,
  ArrowRightLeft,
  Building2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type StockFilter = "all" | "low" | "out";

interface BranchProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
}

export default function InventoryPage() {
  const { currentBranch, branches } = useBranch();
  const { user } = useAuth();
  const [products, setProducts] = useState<BranchProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  
  // Stock adjustment dialog
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BranchProduct | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Transfer dialog
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferProduct, setTransferProduct] = useState<BranchProduct | null>(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (currentBranch) {
      loadBranchProducts();
    }
  }, [currentBranch]);

  async function loadBranchProducts() {
    if (!currentBranch) return;
    
    setLoading(true);
    try {
      // Get products with their branch-specific stock
      const { data: productBranches, error } = await supabase
        .from('product_branches')
        .select(`
          id,
          product_id,
          stock_quantity,
          low_stock_threshold,
          products (
            id,
            name,
            sku,
            unit_price
          )
        `)
        .eq('branch_id', currentBranch.id);

      if (error) throw error;

      // Also get products that don't have branch inventory yet
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, unit_price, low_stock_threshold')
        .eq('is_active', true);

      if (productsError) throw productsError;

      const branchProductIds = new Set(productBranches?.map(pb => pb.product_id) || []);
      
      const branchProducts: BranchProduct[] = [];
      
      // Add products with branch inventory
      productBranches?.forEach(pb => {
        const product = pb.products as any;
        if (product) {
          branchProducts.push({
            id: pb.id,
            product_id: pb.product_id,
            name: product.name,
            sku: product.sku,
            unit_price: product.unit_price,
            stock_quantity: pb.stock_quantity,
            low_stock_threshold: pb.low_stock_threshold || 10,
          });
        }
      });

      // Add products without branch inventory (with 0 stock)
      allProducts?.forEach(product => {
        if (!branchProductIds.has(product.id)) {
          branchProducts.push({
            id: '', // No product_branches record yet
            product_id: product.id,
            name: product.name,
            sku: product.sku,
            unit_price: product.unit_price,
            stock_quantity: 0,
            low_stock_threshold: product.low_stock_threshold || 10,
          });
        }
      });

      setProducts(branchProducts.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error loading branch products:", error);
      toast({ title: "Error loading inventory", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filter === "low") {
      return matchesSearch && product.stock_quantity <= product.low_stock_threshold && product.stock_quantity > 0;
    }
    if (filter === "out") {
      return matchesSearch && product.stock_quantity === 0;
    }
    return matchesSearch;
  });

  const lowStockCount = products.filter(p => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length;
  const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);

  function openAdjustment(product: BranchProduct, type: "add" | "remove") {
    setSelectedProduct(product);
    setAdjustmentType(type);
    setAdjustmentQty("");
    setAdjustmentNotes("");
    setAdjustmentDialog(true);
  }

  function openTransfer(product: BranchProduct) {
    setTransferProduct(product);
    setTargetBranchId("");
    setTransferQty("");
    setTransferNotes("");
    setTransferDialog(true);
  }

  async function handleAdjustment() {
    if (!selectedProduct || !adjustmentQty || !currentBranch || !user) return;

    const qty = parseInt(adjustmentQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    if (adjustmentType === "remove" && qty > selectedProduct.stock_quantity) {
      toast({ title: "Cannot remove more than current stock", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const newQuantity = adjustmentType === "add" 
        ? selectedProduct.stock_quantity + qty 
        : selectedProduct.stock_quantity - qty;

      // Upsert product_branches record
      const { error: upsertError } = await supabase
        .from('product_branches')
        .upsert({
          id: selectedProduct.id || undefined,
          product_id: selectedProduct.product_id,
          branch_id: currentBranch.id,
          stock_quantity: newQuantity,
          low_stock_threshold: selectedProduct.low_stock_threshold,
        }, { 
          onConflict: 'product_id,branch_id',
          ignoreDuplicates: false 
        });

      if (upsertError) throw upsertError;

      // Record stock movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: selectedProduct.product_id,
          branch_id: currentBranch.id,
          quantity: adjustmentType === "add" ? qty : -qty,
          movement_type: adjustmentType === "add" ? "adjustment_in" : "adjustment_out",
          notes: adjustmentNotes || "Manual adjustment",
          created_by: user.id,
        });

      if (movementError) throw movementError;
      
      // Update local state
      setProducts(products.map(p => 
        p.product_id === selectedProduct.product_id 
          ? { ...p, stock_quantity: newQuantity } 
          : p
      ));
      
      toast({ 
        title: `Stock ${adjustmentType === "add" ? "added" : "removed"} successfully`,
        description: `${selectedProduct.name}: ${adjustmentType === "add" ? "+" : "-"}${qty} units`
      });
      setAdjustmentDialog(false);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast({ title: "Error adjusting stock", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTransfer() {
    if (!transferProduct || !transferQty || !targetBranchId || !currentBranch || !user) return;

    const qty = parseInt(transferQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    if (qty > transferProduct.stock_quantity) {
      toast({ title: "Cannot transfer more than available stock", variant: "destructive" });
      return;
    }

    setTransferring(true);
    try {
      // Reduce stock at source branch
      const { error: sourceError } = await supabase
        .from('product_branches')
        .update({ stock_quantity: transferProduct.stock_quantity - qty })
        .eq('product_id', transferProduct.product_id)
        .eq('branch_id', currentBranch.id);

      if (sourceError) throw sourceError;

      // Get or create target branch inventory
      const { data: targetInventory } = await supabase
        .from('product_branches')
        .select('id, stock_quantity')
        .eq('product_id', transferProduct.product_id)
        .eq('branch_id', targetBranchId)
        .maybeSingle();

      if (targetInventory) {
        // Update existing
        const { error: targetError } = await supabase
          .from('product_branches')
          .update({ stock_quantity: targetInventory.stock_quantity + qty })
          .eq('id', targetInventory.id);

        if (targetError) throw targetError;
      } else {
        // Create new
        const { error: createError } = await supabase
          .from('product_branches')
          .insert({
            product_id: transferProduct.product_id,
            branch_id: targetBranchId,
            stock_quantity: qty,
            low_stock_threshold: transferProduct.low_stock_threshold,
          });

        if (createError) throw createError;
      }

      const targetBranch = branches.find(b => b.id === targetBranchId);
      
      // Record stock movements for both branches
      await supabase.from('stock_movements').insert([
        {
          product_id: transferProduct.product_id,
          branch_id: currentBranch.id,
          quantity: -qty,
          movement_type: "transfer_out",
          notes: `Transfer to ${targetBranch?.name || 'another branch'}${transferNotes ? ': ' + transferNotes : ''}`,
          created_by: user.id,
        },
        {
          product_id: transferProduct.product_id,
          branch_id: targetBranchId,
          quantity: qty,
          movement_type: "transfer_in",
          notes: `Transfer from ${currentBranch.name}${transferNotes ? ': ' + transferNotes : ''}`,
          created_by: user.id,
        }
      ]);
      
      // Update local state
      setProducts(products.map(p => 
        p.product_id === transferProduct.product_id 
          ? { ...p, stock_quantity: p.stock_quantity - qty } 
          : p
      ));
      
      toast({ 
        title: "Stock transferred successfully",
        description: `${qty} units of ${transferProduct.name} transferred to ${targetBranch?.name}`
      });
      setTransferDialog(false);
    } catch (error) {
      console.error("Error transferring stock:", error);
      toast({ title: "Error transferring stock", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  }

  function getStockBadge(product: BranchProduct) {
    if (product.stock_quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return <Badge variant="warning" className="bg-warning text-warning-foreground">Low Stock</Badge>;
    }
    return <Badge variant="success" className="bg-success text-success-foreground">In Stock</Badge>;
  }

  const otherBranches = branches.filter(b => b.id !== currentBranch?.id);

  if (!currentBranch) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select a branch to view inventory</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-4 h-4 text-primary" />
              <p className="text-muted-foreground">
                Showing stock for <span className="font-medium text-foreground">{currentBranch.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
          
          <Card className={lowStockCount > 0 ? "border-warning" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{lowStockCount}</div>
            </CardContent>
          </Card>
          
          <Card className={outOfStockCount > 0 ? "border-destructive" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{outOfStockCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as StockFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading inventory...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground">
                  {products.length === 0 ? "Add products to start tracking inventory" : "Try adjusting your search or filter"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {product.sku || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {product.stock_quantity}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {product.low_stock_threshold}
                      </TableCell>
                      <TableCell>{getStockBadge(product)}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${product.unit_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${(product.stock_quantity * product.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAdjustment(product, "add")}
                            title="Add stock"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAdjustment(product, "remove")}
                            disabled={product.stock_quantity === 0}
                            title="Remove stock"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          {otherBranches.length > 0 && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openTransfer(product)}
                              disabled={product.stock_quantity === 0}
                              title="Transfer to another branch"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stock Adjustment Dialog */}
        <Dialog open={adjustmentDialog} onOpenChange={setAdjustmentDialog}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>
                {adjustmentType === "add" ? "Add Stock" : "Remove Stock"}
              </DialogTitle>
              <DialogDescription>
                {selectedProduct?.name} at {currentBranch.name} - Current stock: {selectedProduct?.stock_quantity} units
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  placeholder="Enter quantity"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(e.target.value)}
                  min="1"
                  max={adjustmentType === "remove" ? selectedProduct?.stock_quantity : undefined}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Reason for adjustment..."
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                />
              </div>
              
              {adjustmentQty && selectedProduct && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    New stock level: <span className="font-bold text-foreground">
                      {adjustmentType === "add" 
                        ? selectedProduct.stock_quantity + parseInt(adjustmentQty || "0")
                        : selectedProduct.stock_quantity - parseInt(adjustmentQty || "0")
                      } units
                    </span>
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustmentDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAdjustment} 
                disabled={saving || !adjustmentQty}
                className={adjustmentType === "add" ? "bg-success hover:bg-success/90" : ""}
              >
                {saving ? "Saving..." : adjustmentType === "add" ? "Add Stock" : "Remove Stock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stock Transfer Dialog */}
        <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Transfer Stock
              </DialogTitle>
              <DialogDescription>
                Transfer {transferProduct?.name} from {currentBranch.name} to another branch
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Available at {currentBranch.name}: <span className="font-bold text-foreground">{transferProduct?.stock_quantity} units</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Destination Branch</Label>
                <Select value={targetBranchId} onValueChange={setTargetBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {otherBranches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity to Transfer</Label>
                <Input
                  type="number"
                  placeholder="Enter quantity"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  min="1"
                  max={transferProduct?.stock_quantity}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Reason for transfer..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
              </div>
              
              {transferQty && transferProduct && targetBranchId && (
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {currentBranch.name}: <span className="font-bold text-foreground">
                      {transferProduct.stock_quantity - parseInt(transferQty || "0")} units
                    </span> (after transfer)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {branches.find(b => b.id === targetBranchId)?.name}: <span className="font-bold text-foreground">
                      +{parseInt(transferQty || "0")} units
                    </span>
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleTransfer} 
                disabled={transferring || !transferQty || !targetBranchId}
              >
                {transferring ? "Transferring..." : "Transfer Stock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
