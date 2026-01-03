import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Wand2, Barcode } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getProduct, addProduct, updateProduct, getCategories, Category } from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";
import { BarcodeGenerator, generateBarcodeValue } from "@/components/BarcodeGenerator";

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

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

  useEffect(() => {
    loadCategories();
    if (isEditing && id) {
      loadProduct(id);
    }
  }, [id, isEditing]);

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

      if (isEditing && id) {
        await updateProduct(id, productData);
        toast({ title: "Product updated successfully" });
      } else {
        await addProduct(productData);
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
