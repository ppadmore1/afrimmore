import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Wand2, Barcode, Plus, Trash2, Truck, Star } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { getProduct, addProduct, updateProduct, getCategories, Category } from "@/lib/supabase-db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BarcodeGenerator, generateBarcodeValue } from "@/components/BarcodeGenerator";

interface Supplier {
  id: string;
  name: string;
  code: string | null;
}

interface ProductSupplier {
  id?: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string | null;
  supplier_sku: string | null;
  cost_price: number;
  lead_time_days: number;
  is_preferred: boolean;
}

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [stockQuantity, setStockQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [taxRate, setTaxRate] = useState("0");
  const [isActive, setIsActive] = useState(true);

  // Add supplier dialog
  const [addSupplierDialogOpen, setAddSupplierDialogOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [supplierCostPrice, setSupplierCostPrice] = useState("");
  const [supplierLeadTime, setSupplierLeadTime] = useState("7");
  const [supplierIsPreferred, setSupplierIsPreferred] = useState(false);

  useEffect(() => {
    loadCategories();
    loadSuppliers();
    if (isEditing && id) {
      loadProduct(id);
      loadProductSuppliers(id);
    }
  }, [id, isEditing]);

  async function loadSuppliers() {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error("Error loading suppliers:", err);
    }
  }

  async function loadProductSuppliers(productId: string) {
    try {
      const { data, error } = await supabase
        .from("product_suppliers")
        .select(`
          id,
          supplier_id,
          supplier_sku,
          cost_price,
          lead_time_days,
          is_preferred,
          suppliers (name, code)
        `)
        .eq("product_id", productId);

      if (error) throw error;

      setProductSuppliers(
        (data || []).map((ps: any) => ({
          id: ps.id,
          supplier_id: ps.supplier_id,
          supplier_name: ps.suppliers?.name || "Unknown",
          supplier_code: ps.suppliers?.code || null,
          supplier_sku: ps.supplier_sku,
          cost_price: Number(ps.cost_price) || 0,
          lead_time_days: ps.lead_time_days || 7,
          is_preferred: ps.is_preferred || false,
        }))
      );
    } catch (err) {
      console.error("Error loading product suppliers:", err);
    }
  }

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function loadProduct(productId: string) {
    try {
      const product = await getProduct(productId);
      if (product) {
        setName(product.name);
        setDescription(product.description || "");
        setSku(product.sku || "");
        setBarcode(product.barcode || "");
        setCategoryId(product.category_id || "");
        setUnitPrice(product.unit_price.toString());
        setCostPrice(product.cost_price?.toString() || "");
        setUnit(product.unit || "pcs");
        setStockQuantity(product.stock_quantity.toString());
        setLowStockThreshold(product.low_stock_threshold?.toString() || "10");
        setTaxRate(product.tax_rate?.toString() || "0");
        setIsActive(product.is_active !== false);
      }
    } catch (error) {
      console.error("Error loading product:", error);
      toast({ title: "Error loading product", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleAddSupplier() {
    if (!selectedSupplierId) {
      toast({ title: "Please select a supplier", variant: "destructive" });
      return;
    }

    // Check if already added
    if (productSuppliers.some((ps) => ps.supplier_id === selectedSupplierId)) {
      toast({ title: "Supplier already added", variant: "destructive" });
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) return;

    // If setting as preferred, unset others
    let updatedSuppliers = [...productSuppliers];
    if (supplierIsPreferred) {
      updatedSuppliers = updatedSuppliers.map((ps) => ({ ...ps, is_preferred: false }));
    }

    updatedSuppliers.push({
      supplier_id: selectedSupplierId,
      supplier_name: supplier.name,
      supplier_code: supplier.code,
      supplier_sku: supplierSku.trim() || null,
      cost_price: parseFloat(supplierCostPrice) || 0,
      lead_time_days: parseInt(supplierLeadTime) || 7,
      is_preferred: supplierIsPreferred,
    });

    setProductSuppliers(updatedSuppliers);
    setAddSupplierDialogOpen(false);
    resetSupplierForm();
  }

  function resetSupplierForm() {
    setSelectedSupplierId("");
    setSupplierSku("");
    setSupplierCostPrice("");
    setSupplierLeadTime("7");
    setSupplierIsPreferred(false);
  }

  function handleRemoveSupplier(supplierId: string) {
    setProductSuppliers(productSuppliers.filter((ps) => ps.supplier_id !== supplierId));
  }

  function handleSetPreferred(supplierId: string) {
    setProductSuppliers(
      productSuppliers.map((ps) => ({
        ...ps,
        is_preferred: ps.supplier_id === supplierId,
      }))
    );
  }

  async function saveProductSuppliers(productId: string) {
    // Delete existing and insert new
    await supabase.from("product_suppliers").delete().eq("product_id", productId);

    if (productSuppliers.length > 0) {
      const { error } = await supabase.from("product_suppliers").insert(
        productSuppliers.map((ps) => ({
          product_id: productId,
          supplier_id: ps.supplier_id,
          supplier_sku: ps.supplier_sku,
          cost_price: ps.cost_price,
          lead_time_days: ps.lead_time_days,
          is_preferred: ps.is_preferred,
        }))
      );
      if (error) throw error;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Please enter a product name", variant: "destructive" });
      return;
    }

    if (!unitPrice || parseFloat(unitPrice) < 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const productData = {
        name: name.trim(),
        description: description.trim() || null,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        category_id: categoryId || null,
        unit_price: parseFloat(unitPrice),
        cost_price: costPrice ? parseFloat(costPrice) : null,
        unit: unit.trim() || "pcs",
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : 0,
        low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold) : 10,
        tax_rate: taxRate ? parseFloat(taxRate) : 0,
        is_active: isActive,
        image_url: null,
      };

      let productId = id;

      if (isEditing && id) {
        await updateProduct(id, productData);
        await saveProductSuppliers(id);
        toast({ title: "Product updated successfully" });
      } else {
        const newProduct = await addProduct(productData);
        if (newProduct?.id) {
          await saveProductSuppliers(newProduct.id);
        }
        toast({ title: "Product created successfully" });
      }

      navigate("/products");
    } catch (error) {
      console.error("Error saving product:", error);
      toast({ title: "Error saving product", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditing ? "Edit Product" : "New Product"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEditing ? "Update product information" : "Add a new product or service"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Product or service name"
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the product or service"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Stock keeping unit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Product barcode"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const newBarcode = generateBarcodeValue(id || crypto.randomUUID());
                      setBarcode(newBarcode);
                      toast({ title: "Barcode generated" });
                    }}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                </div>
                {barcode && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <BarcodeGenerator value={barcode} productName={name} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="">No category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g., pcs, kg, hour"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Selling Price *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stockQuantity">Stock Quantity</Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="10"
                />
              </div>

              <div className="flex items-center justify-between sm:col-span-2 p-4 bg-muted rounded-lg">
                <div>
                  <Label htmlFor="isActive">Active Product</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive products won't appear in POS or invoices
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </CardContent>
          </Card>

          {/* Suppliers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Suppliers
                </CardTitle>
                <CardDescription>
                  Manage suppliers who provide this product
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => setAddSupplierDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {productSuppliers.length === 0 ? (
                <div className="p-8 text-center border-t">
                  <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-foreground mb-1">No suppliers linked</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Link suppliers to track pricing and lead times
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddSupplierDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Supplier
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Supplier SKU</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Lead Time</TableHead>
                      <TableHead className="text-center">Preferred</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productSuppliers.map((ps) => (
                      <TableRow key={ps.supplier_id}>
                        <TableCell>
                          <div className="font-medium">{ps.supplier_name}</div>
                          {ps.supplier_code && (
                            <div className="text-sm text-muted-foreground font-mono">
                              {ps.supplier_code}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {ps.supplier_sku || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${ps.cost_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {ps.lead_time_days} days
                        </TableCell>
                        <TableCell className="text-center">
                          {ps.is_preferred ? (
                            <Badge variant="default" className="gap-1">
                              <Star className="w-3 h-3" />
                              Preferred
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPreferred(ps.supplier_id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              Set Preferred
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSupplier(ps.supplier_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add Supplier Dialog */}
          <Dialog open={addSupplierDialogOpen} onOpenChange={setAddSupplierDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Supplier</DialogTitle>
                <DialogDescription>
                  Link a supplier to this product with their pricing and lead time
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {suppliers
                        .filter((s) => !productSuppliers.some((ps) => ps.supplier_id === s.id))
                        .map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {supplier.code && <span className="text-muted-foreground ml-2">({supplier.code})</span>}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier SKU</Label>
                    <Input
                      value={supplierSku}
                      onChange={(e) => setSupplierSku(e.target.value)}
                      placeholder="Supplier's product code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={supplierCostPrice}
                        onChange={(e) => setSupplierCostPrice(e.target.value)}
                        className="pl-7"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lead Time (days)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={supplierLeadTime}
                      onChange={(e) => setSupplierLeadTime(e.target.value)}
                      placeholder="7"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Switch
                      id="preferred"
                      checked={supplierIsPreferred}
                      onCheckedChange={setSupplierIsPreferred}
                    />
                    <Label htmlFor="preferred">Preferred supplier</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddSupplierDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleAddSupplier}>
                  Add Supplier
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </form>
      </motion.div>
    </AppLayout>
  );
}
