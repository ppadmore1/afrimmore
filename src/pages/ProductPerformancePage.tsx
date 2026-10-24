import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type P = { id: string; name: string; sku: string | null; unit_price: number; cost_price: number | null; stock_quantity: number };
type M = { id: string; quantity: number; movement_type: string; created_at: string; notes: string | null };
type S = { quantity: number; unit_price: number; discount: number | null; total: number; created_at: string };

export default function ProductPerformancePage() {
  const [products, setProducts] = useState<P[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<P | null>(null);
  const [moves, setMoves] = useState<M[]>([]);
  const [sales, setSales] = useState<S[]>([]);

  useEffect(() => {
    supabase.from("products").select("id,name,sku,unit_price,cost_price,stock_quantity").order("name")
      .then(({ data }) => setProducts((data as P[]) || []));
  }, []);

  useEffect(() => {
    if (!sel) return;
    supabase.from("stock_movements").select("id,quantity,movement_type,created_at,notes").eq("product_id", sel.id).order("created_at", { ascending: false })
      .then(({ data }) => setMoves((data as M[]) || []));
    supabase.from("pos_sale_items").select("quantity,unit_price,discount,total,created_at").eq("product_id", sel.id)
      .then(({ data }) => setSales((data as S[]) || []));
  }, [sel]);

  const list = useMemo(() => products.filter(p => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 20), [products, q]);
  const units = sales.reduce((a, s) => a + Number(s.quantity), 0);
  const net = sales.reduce((a, s) => a + Number(s.total), 0);
  const cogs = units * Number(sel?.cost_price || 0);
  const profit = net - cogs;
  const margin = net ? (profit / net) * 100 : 0;
  const last = sales.map(s => s.created_at).sort().pop();
  const slow = sel && (!last || Date.now() - new Date(last).getTime() > 30 * 864e5);

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold">Product Performance</h1>
        <Input placeholder="Search product name or SKU" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {list.map(p => (
            <Badge key={p.id} variant={sel?.id === p.id ? "default" : "outline"} className="cursor-pointer" onClick={() => setSel(p)}>{p.name}</Badge>
          ))}
        </div>
        {sel && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[["Units sold", units], ["Net sales", `$${net.toFixed(2)}`], ["Cost of goods", `$${cogs.toFixed(2)}`], ["Gross profit", `$${profit.toFixed(2)}`], ["Margin", `${margin.toFixed(1)}%`]].map(([l, v]) => (
                <Card key={l as string}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="text-xl font-semibold">{v}</p></CardContent></Card>
              ))}
            </div>
            <p className="text-sm">Current stock: {sel.stock_quantity} {slow && <Badge variant="destructive" className="ml-2">Slow-moving (no sales 30+ days)</Badge>}</p>
            <Card>
              <CardHeader><CardTitle>Stock history</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {moves.map(m => (
                      <TableRow key={m.id}><TableCell>{new Date(m.created_at).toLocaleString()}</TableCell><TableCell>{m.movement_type}</TableCell><TableCell>{m.quantity}</TableCell><TableCell>{m.notes}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
