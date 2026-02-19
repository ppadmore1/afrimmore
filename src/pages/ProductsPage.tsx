import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Package, 
  MoreHorizontal,
  Edit,
  Trash2,
  Barcode,
  Wand2,
  Loader2,
   Download,
   Upload,
   Filter,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProducts, deleteProduct, updateProduct, Product, getCategories, Category } from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";
import { BarcodeDialog, generateBarcodeValue } from "@/components/BarcodeGenerator";
 import { ImportDialog } from "@/components/ImportDialog";
 import { parseCSV, generateCSV, downloadCSV } from "@/lib/csv";
 import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingBarcodes, setGeneratingBarcodes] = useState(false);
  const [downloadingBarcodes, setDownloadingBarcodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
   const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {}
  }

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteProduct(id);
        setProducts(products.filter(p => p.id !== id));
        toast({ title: "Product deleted successfully" });
      } catch (error) {
        toast({ title: "Error deleting product", variant: "destructive" });
      }
    }
  }
 
   // Export products to CSV
   const handleExport = () => {
     const csvContent = generateCSV(products, [
       { key: "name", header: "Name" },
       { key: "description", header: "Description" },
       { key: "sku", header: "SKU" },
       { key: "barcode", header: "Barcode" },
       { key: "unit_price", header: "Unit Price" },
       { key: "cost_price", header: "Cost Price" },
       { key: "stock_quantity", header: "Stock Quantity" },
       { key: "low_stock_threshold", header: "Low Stock Threshold" },
       { key: "unit", header: "Unit" },
       { key: "tax_rate", header: "Tax Rate" },
     ]);
     downloadCSV(csvContent, `products_export_${new Date().toISOString().split("T")[0]}.csv`);
     toast({ title: "Exported", description: `${products.length} products exported to CSV` });
   };
 
   // Parse CSV for import
   const parseProductsCSV = (csvText: string) => {
     return parseCSV<Product>(csvText, {
       name: "name",
       description: "description",
       sku: "sku",
       barcode: "barcode",
       "unit price": "unit_price",
       "cost price": "cost_price",
       "stock quantity": "stock_quantity",
       "low stock threshold": "low_stock_threshold",
       unit: "unit",
       "tax rate": "tax_rate",
     });
   };
 
   // Import products
   const handleImport = async (data: Partial<Product>[]): Promise<{ success: number; failed: number }> => {
     let success = 0;
     let failed = 0;
 
     for (const row of data) {
       if (!row.name) {
         failed++;
         continue;
       }
 
       const productData = {
         name: row.name,
         description: row.description || null,
         sku: row.sku || null,
         barcode: row.barcode || null,
         unit_price: parseFloat(String(row.unit_price)) || 0,
         cost_price: parseFloat(String(row.cost_price)) || 0,
         stock_quantity: parseInt(String(row.stock_quantity)) || 0,
         low_stock_threshold: parseInt(String(row.low_stock_threshold)) || 10,
         unit: row.unit || "pcs",
         tax_rate: parseFloat(String(row.tax_rate)) || 0,
       };
 
       const { error } = await supabase.from("products").insert(productData);
       if (error) {
         console.error("Import error:", error);
         failed++;
       } else {
         success++;
       }
     }
 
     return { success, failed };
   };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === "all" || product.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const productsWithoutBarcode = products.filter(p => !p.barcode);

  async function generateAllBarcodes() {
    if (productsWithoutBarcode.length === 0) {
      toast({ title: "All products already have barcodes" });
      return;
    }

    setGeneratingBarcodes(true);
    let generated = 0;

    try {
      for (const product of productsWithoutBarcode) {
        const newBarcode = generateBarcodeValue(product.id);
        await updateProduct(product.id, { barcode: newBarcode });
        generated++;
      }

      await loadProducts();
      toast({ 
        title: "Barcodes generated", 
        description: `Generated barcodes for ${generated} products` 
      });
    } catch (error) {
      console.error("Error generating barcodes:", error);
      toast({ 
        title: "Error generating barcodes", 
        description: `Generated ${generated} before error occurred`,
        variant: "destructive" 
      });
    } finally {
      setGeneratingBarcodes(false);
    }
  }

  async function downloadBulkBarcodes() {
    const productsWithBarcode = filteredProducts.filter(p => p.barcode);
    if (productsWithBarcode.length === 0) {
      toast({ title: "No products with barcodes to download", variant: "destructive" });
      return;
    }

    setDownloadingBarcodes(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const cols = 3;
      const rows = 6;
      const cellW = pageW / cols;
      const cellH = pageH / rows;
      const margin = 4;

      for (let i = 0; i < productsWithBarcode.length; i++) {
        const product = productsWithBarcode[i];
        const col = i % cols;
        const row = Math.floor(i / cols) % rows;

        if (i > 0 && i % (cols * rows) === 0) {
          doc.addPage();
        }

        const x = col * cellW + margin;
        const y = row * cellH + margin;
        const w = cellW - margin * 2;
        const h = cellH - margin * 2;

        // Draw border
        doc.setDrawColor(200, 200, 200);
        doc.rect(col * cellW + 1, row * cellH + 1, cellW - 2, cellH - 2, "S");

        // Product name
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const nameLines = doc.splitTextToSize(product.name, w);
        doc.text(nameLines[0], x + w / 2, y + 5, { align: "center" });

        // Generate barcode as SVG then convert
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, product.barcode!, {
          format: "CODE128",
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 2,
        });
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", x, y + 7, w, h - 12);

        // Price
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`$${product.unit_price.toFixed(2)}`, x + w / 2, y + h - 1, { align: "center" });
      }

      doc.save(`barcodes_${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "Barcodes downloaded", description: `${productsWithBarcode.length} barcodes exported to PDF` });
    } catch (error) {
      console.error("Barcode download error:", error);
      toast({ title: "Error generating barcode PDF", variant: "destructive" });
    } finally {
      setDownloadingBarcodes(false);
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
            <h1 className="text-3xl font-bold text-foreground">Products & Services</h1>
            <p className="text-muted-foreground mt-1">Manage your product catalog</p>
          </div>
          <div className="flex flex-wrap gap-2">
             <Button variant="outline" onClick={handleExport} disabled={products.length === 0}>
               <Download className="w-4 h-4 mr-2" />
               Export CSV
             </Button>
             <Button variant="outline" onClick={() => setIsImportOpen(true)}>
               <Upload className="w-4 h-4 mr-2" />
               Import
             </Button>
            <Button
              variant="outline"
              onClick={downloadBulkBarcodes}
              disabled={downloadingBarcodes || filteredProducts.filter(p => p.barcode).length === 0}
            >
              {downloadingBarcodes ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Barcode className="w-4 h-4 mr-2" />
              )}
              Download Barcodes ({filteredProducts.filter(p => p.barcode).length})
            </Button>
            {productsWithoutBarcode.length > 0 && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={generateAllBarcodes}
                disabled={generatingBarcodes}
              >
                {generatingBarcodes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Generate Barcodes ({productsWithoutBarcode.length})
              </Button>
            )}
            <Link to="/products/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </Link>
          </div>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-52">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


        {/* Products Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-12 w-12 bg-muted rounded-lg mb-4" />
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {products.length === 0 ? "No products yet" : "No matching products"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {products.length === 0 
                  ? "Add your first product or service" 
                  : "Try adjusting your search"}
              </p>
              {products.length === 0 && (
                <Link to="/products/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="group">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                          <Package className="w-6 h-6 text-success" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                          <p className="text-lg font-bold font-mono text-primary">
                            ${product.unit_price.toFixed(2)}
                            {product.unit && <span className="text-sm font-normal text-muted-foreground">/{product.unit}</span>}
                          </p>
                        </div>
                      </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem asChild>
                          <Link to={`/products/${product.id}/edit`} className="cursor-pointer">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(product.id)}
                          className="text-destructive cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {product.description && (
                    <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {product.stock_quantity !== undefined && (
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <Badge variant={product.stock_quantity > (product.low_stock_threshold || 10) ? "default" : product.stock_quantity > 0 ? "secondary" : "destructive"}>
                        {product.stock_quantity} in stock
                      </Badge>
                      {product.barcode && (
                        <BarcodeDialog 
                          value={product.barcode} 
                          productName={product.name}
                          trigger={
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <Barcode className="w-3 h-3 mr-1" />
                              Barcode
                            </Button>
                          }
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
 
       <ImportDialog<Product>
         open={isImportOpen}
         onOpenChange={setIsImportOpen}
         title="Import Products"
         description="Upload a CSV file to bulk import products. Required column: Name."
         templateColumns={["Name", "Description", "SKU", "Barcode", "Unit Price", "Cost Price", "Stock Quantity", "Low Stock Threshold", "Unit", "Tax Rate"]}
         parseData={parseProductsCSV}
         onImport={handleImport}
         onComplete={loadProducts}
       />
    </AppLayout>
  );
}
