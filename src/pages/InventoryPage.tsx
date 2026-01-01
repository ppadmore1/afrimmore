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
import { getProducts, updateStock, Product } from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";

type StockFilter = "all" | "low" | "out";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error loading products:", error);
      toast({ title: "Error loading inventory", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filter === "low") {
      return matchesSearch && product.stock_quantity <= (product.low_stock_threshold || 10) && product.stock_quantity > 0;
    }
    if (filter === "out") {
      return matchesSearch && product.stock_quantity === 0;
    }
    return matchesSearch;
  });

  const lowStockCount = products.filter(p => p.stock_quantity <= (p.low_stock_threshold || 10) && p.stock_quantity > 0).length;
  const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);

  function openAdjustment(product: Product, type: "add" | "remove") {
    setSelectedProduct(product);
    setAdjustmentType(type);
    setAdjustmentQty("");
    setAdjustmentNotes("");
    setAdjustmentDialog(true);
  }

  async function handleAdjustment() {
    if (!selectedProduct || !adjustmentQty) return;

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

      const movementType = adjustmentType === "add" ? "in" : "out";
      await updateStock(selectedProduct.id, qty, movementType, adjustmentNotes || "manual_adjustment");
      
      setProducts(products.map(p => 
        p.id === selectedProduct.id ? { ...p, stock_quantity: newQuantity } : p
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

  function getStockBadge(product: Product) {
    if (product.stock_quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.stock_quantity <= (product.low_stock_threshold || 10)) {
      return <Badge variant="warning" className="bg-warning text-warning-foreground">Low Stock</Badge>;
    }
    return <Badge variant="success" className="bg-success text-success-foreground">In Stock</Badge>;
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Monitor stock levels and manage adjustments</p>
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
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {product.sku || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {product.stock_quantity}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {product.low_stock_threshold || 10}
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
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAdjustment(product, "remove")}
                            disabled={product.stock_quantity === 0}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
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
                {selectedProduct?.name} - Current stock: {selectedProduct?.stock_quantity} units
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
      </motion.div>
    </AppLayout>
  );
}
