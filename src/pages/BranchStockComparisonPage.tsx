import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Building2, 
  Package, 
  Search,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useBranch, Branch } from "@/contexts/BranchContext";
import { toast } from "@/hooks/use-toast";

interface ProductStock {
  product_id: string;
  product_name: string;
  sku: string | null;
  unit_price: number;
  branchStock: Record<string, number>;
  totalStock: number;
}

export default function BranchStockComparisonPage() {
  const { branches } = useBranch();
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "total">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const activeBranches = branches.filter(b => b.is_active);

  useEffect(() => {
    if (activeBranches.length > 0) {
      loadStockComparison();
    }
  }, [branches]);

  async function loadStockComparison() {
    setLoading(true);
    try {
      // Get all products
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, unit_price')
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;

      // Get all branch stock
      const { data: branchStock, error: stockError } = await supabase
        .from('product_branches')
        .select('product_id, branch_id, stock_quantity');

      if (stockError) throw stockError;

      // Build stock map
      const stockMap: Record<string, Record<string, number>> = {};
      branchStock?.forEach(item => {
        if (!stockMap[item.product_id]) {
          stockMap[item.product_id] = {};
        }
        stockMap[item.product_id][item.branch_id] = item.stock_quantity;
      });

      // Combine data
      const productStocks: ProductStock[] = (allProducts || []).map(product => {
        const branchStockData: Record<string, number> = {};
        let totalStock = 0;

        activeBranches.forEach(branch => {
          const qty = stockMap[product.id]?.[branch.id] || 0;
          branchStockData[branch.id] = qty;
          totalStock += qty;
        });

        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          unit_price: product.unit_price,
          branchStock: branchStockData,
          totalStock,
        };
      });

      setProducts(productStocks);
    } catch (error) {
      console.error("Error loading stock comparison:", error);
      toast({ title: "Error loading stock data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products
    .filter(product => 
      product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") {
        return sortDir === "asc" 
          ? a.product_name.localeCompare(b.product_name)
          : b.product_name.localeCompare(a.product_name);
      }
      return sortDir === "asc" 
        ? a.totalStock - b.totalStock
        : b.totalStock - a.totalStock;
    });

  function toggleSort(column: "name" | "total") {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function getStockCell(qty: number) {
    if (qty === 0) {
      return (
        <span className="text-destructive font-mono font-bold">0</span>
      );
    }
    if (qty <= 10) {
      return (
        <span className="text-warning font-mono font-bold">{qty}</span>
      );
    }
    return <span className="font-mono">{qty}</span>;
  }

  // Calculate branch totals
  const branchTotals: Record<string, number> = {};
  activeBranches.forEach(branch => {
    branchTotals[branch.id] = filteredProducts.reduce(
      (sum, p) => sum + (p.branchStock[branch.id] || 0), 
      0
    );
  });

  const grandTotal = filteredProducts.reduce((sum, p) => sum + p.totalStock, 0);

  // Find branches with low stock items
  const lowStockByBranch: Record<string, number> = {};
  activeBranches.forEach(branch => {
    lowStockByBranch[branch.id] = products.filter(
      p => p.branchStock[branch.id] === 0 || p.branchStock[branch.id] <= 10
    ).length;
  });

  if (activeBranches.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No branches available</p>
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Branch Stock Comparison</h1>
          <p className="text-muted-foreground mt-1">
            Compare stock levels across all {activeBranches.length} branches
          </p>
        </div>

        {/* Branch Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {activeBranches.slice(0, 4).map(branch => (
            <Card key={branch.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                  {branch.name}
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{branchTotals[branch.id]?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lowStockByBranch[branch.id]} items need attention
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Comparison Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading stock data...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your search</p>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="sticky left-0 bg-background z-10 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Product
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-center">SKU</TableHead>
                      {activeBranches.map(branch => (
                        <TableHead key={branch.id} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="truncate max-w-[100px]" title={branch.name}>
                              {branch.name}
                            </span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {branch.code}
                            </Badge>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead 
                        className="text-center cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSort("total")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Total
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.product_id}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          <div className="flex items-center gap-2">
                            {product.totalStock === 0 && (
                              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                            )}
                            <span className="truncate max-w-[200px]">{product.product_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">
                          {product.sku || "-"}
                        </TableCell>
                        {activeBranches.map(branch => (
                          <TableCell key={branch.id} className="text-center">
                            {getStockCell(product.branchStock[branch.id] || 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold">
                          {product.totalStock}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell className="sticky left-0 bg-muted/50 z-10">
                        Total ({filteredProducts.length} products)
                      </TableCell>
                      <TableCell></TableCell>
                      {activeBranches.map(branch => (
                        <TableCell key={branch.id} className="text-center font-mono">
                          {branchTotals[branch.id]?.toLocaleString() || 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-mono">
                        {grandTotal.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
