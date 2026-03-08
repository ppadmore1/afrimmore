import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calculator, Package, DollarSign, TrendingUp } from "lucide-react";

interface ProductValuation {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  cost_price: number | null;
  unit_price: number;
  weighted_avg_cost: number;
  fifo_cost: number;
  lifo_cost: number;
  total_value_weighted: number;
  total_value_fifo: number;
  total_value_lifo: number;
}

export default function InventoryValuationPage() {
  const [products, setProducts] = useState<ProductValuation[]>([]);
  const [method, setMethod] = useState<string>("weighted_average");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [prodRes, movRes] = await Promise.all([
        supabase.from("products").select("id, name, sku, stock_quantity, cost_price, unit_price").eq("is_active", true),
        supabase.from("stock_movements").select("product_id, quantity, unit_cost, movement_type, created_at").order("created_at", { ascending: true }),
      ]);

      const movements = movRes.data || [];
      const prods = (prodRes.data || []).map((p: any) => {
        const prodMoves = movements.filter((m: any) => m.product_id === p.id);
        
        // Weighted Average
        let totalQty = 0, totalCost = 0;
        prodMoves.forEach((m: any) => {
          if (m.quantity > 0) { totalQty += m.quantity; totalCost += m.quantity * (m.unit_cost || p.cost_price || 0); }
        });
        const weightedAvg = totalQty > 0 ? totalCost / totalQty : (p.cost_price || 0);

        // FIFO - oldest costs first for remaining stock
        const inboundMoves = prodMoves.filter((m: any) => m.quantity > 0).map((m: any) => ({
          qty: m.quantity, cost: m.unit_cost || p.cost_price || 0,
        }));
        let fifoRemaining = p.stock_quantity;
        let fifoCost = 0;
        for (const batch of inboundMoves) {
          const take = Math.min(fifoRemaining, batch.qty);
          fifoCost += take * batch.cost;
          fifoRemaining -= take;
          if (fifoRemaining <= 0) break;
        }
        const fifoUnit = p.stock_quantity > 0 ? fifoCost / p.stock_quantity : (p.cost_price || 0);

        // LIFO - newest costs first for remaining stock
        const reverseMoves = [...inboundMoves].reverse();
        let lifoRemaining = p.stock_quantity;
        let lifoCost = 0;
        for (const batch of reverseMoves) {
          const take = Math.min(lifoRemaining, batch.qty);
          lifoCost += take * batch.cost;
          lifoRemaining -= take;
          if (lifoRemaining <= 0) break;
        }
        const lifoUnit = p.stock_quantity > 0 ? lifoCost / p.stock_quantity : (p.cost_price || 0);

        return {
          id: p.id, name: p.name, sku: p.sku, stock_quantity: p.stock_quantity,
          cost_price: p.cost_price, unit_price: p.unit_price,
          weighted_avg_cost: weightedAvg, fifo_cost: fifoUnit, lifo_cost: lifoUnit,
          total_value_weighted: weightedAvg * p.stock_quantity,
          total_value_fifo: fifoCost,
          total_value_lifo: lifoCost,
        };
      });
      setProducts(prods);
    } catch { toast({ title: "Error loading data", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const getUnitCost = (p: ProductValuation) => method === "fifo" ? p.fifo_cost : method === "lifo" ? p.lifo_cost : p.weighted_avg_cost;
  const getTotalValue = (p: ProductValuation) => method === "fifo" ? p.total_value_fifo : method === "lifo" ? p.total_value_lifo : p.total_value_weighted;
  const grandTotal = products.reduce((s, p) => s + getTotalValue(p), 0);
  const totalUnits = products.reduce((s, p) => s + p.stock_quantity, 0);
  const totalRetailValue = products.reduce((s, p) => s + (p.unit_price * p.stock_quantity), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Valuation</h1>
            <p className="text-muted-foreground">Calculate inventory value using FIFO, LIFO, or Weighted Average</p>
          </div>
          <div className="w-52">
            <Label>Valuation Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weighted_average">Weighted Average</SelectItem>
                <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
                <SelectItem value="lifo">LIFO (Last In, First Out)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Inventory Value</p><p className="text-2xl font-bold">{fmt(grandTotal)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Retail Value</p><p className="text-2xl font-bold">{fmt(totalRetailValue)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Units</p><p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Calculator className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Potential Margin</p><p className="text-2xl font-bold">{fmt(totalRetailValue - grandTotal)}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Product Valuation — {method === "fifo" ? "FIFO" : method === "lifo" ? "LIFO" : "Weighted Average"}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Unit Cost ({method === "fifo" ? "FIFO" : method === "lifo" ? "LIFO" : "Avg"})</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Retail Value</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.filter(p => p.stock_quantity > 0).map(p => {
                    const unitCost = getUnitCost(p);
                    const totalVal = getTotalValue(p);
                    const retailVal = p.unit_price * p.stock_quantity;
                    const margin = retailVal > 0 ? ((retailVal - totalVal) / retailVal * 100) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.sku || "—"}</TableCell>
                        <TableCell className="text-right">{p.stock_quantity}</TableCell>
                        <TableCell className="text-right">{fmt(p.cost_price || 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(unitCost)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(totalVal)}</TableCell>
                        <TableCell className="text-right">{fmt(retailVal)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={margin > 20 ? "default" : margin > 0 ? "secondary" : "destructive"}>
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={5}>Grand Total</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal)}</TableCell>
                    <TableCell className="text-right">{fmt(totalRetailValue)}</TableCell>
                    <TableCell className="text-right">{fmt(totalRetailValue - grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
